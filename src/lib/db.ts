import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { industryOptions } from "@/lib/industries";

export type Lead = { id: string; lead_number: number; brand_name: string; email: string; phone_number: string; phone_numbers: string[]; city: string; country: string; industry: string; status: "Cold" | "Prospect"; date_added: string; date_converted: string | null };
type LeadInput = { brandName: string; email: string; phoneNumber: string; phoneNumbers: string[]; city: string; country: string; industry: string; phoneKey: string; phoneKeys: string[] };

function firestore() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serialized = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (serialized) {
      const account = JSON.parse(serialized);
      initializeApp({ credential: cert(account), projectId: projectId || account.project_id });
    } else if (email && privateKey && projectId) {
      initializeApp({ credential: cert({ projectId, clientEmail: email, privateKey }), projectId });
    } else if (projectId) {
      initializeApp({ credential: applicationDefault(), projectId });
    } else {
      throw new Error("Firebase is not configured. Set FIREBASE_PROJECT_ID and service account credentials.");
    }
  }
  return getFirestore();
}

function toLead(id: string, data: FirebaseFirestore.DocumentData): Lead {
  const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
  const primaryPhone = typeof data.phone_number === "string" ? data.phone_number : typeof data.whatsapp_number === "string" ? data.whatsapp_number : "";
  const storedPhones = Array.isArray(data.phone_numbers) ? data.phone_numbers : Array.isArray(data.whatsapp_numbers) ? data.whatsapp_numbers : [primaryPhone, "", ""];
  const phoneNumbers = [0, 1, 2].map((index) => typeof storedPhones[index] === "string" ? storedPhones[index] : "");
  return { id, lead_number: Number.isSafeInteger(data.lead_number) ? data.lead_number : 0, brand_name: data.brand_name, email: typeof data.email === "string" ? data.email : "", phone_number: primaryPhone || phoneNumbers[0] || "", phone_numbers: phoneNumbers, city: typeof data.city === "string" ? data.city : "", country: typeof data.country === "string" && data.country.trim() ? data.country.trim().toUpperCase() : "TZ", industry: typeof data.industry === "string" && industryOptions.includes(data.industry as (typeof industryOptions)[number]) ? data.industry : "Other", status: data.status, date_added: iso(data.date_added) ?? new Date(0).toISOString(), date_converted: iso(data.date_converted) };
}

export function normalizePhone(value: string) { return value.replace(/\D/g, ""); }

export function validateLead(brand: unknown, phoneValues: unknown, emailValue?: unknown, cityValue?: unknown, countryValue?: unknown, industryValue?: unknown) {
  const brandName = typeof brand === "string" ? brand.trim() : "";
  const submittedPhones = Array.isArray(phoneValues) ? phoneValues : [phoneValues];
  if (submittedPhones.length > 3) return { error: "Enter no more than three phone numbers." };
  const phoneNumbers = submittedPhones.slice(0, 3).map((phone) => typeof phone === "string" ? phone : "");
  while (phoneNumbers.length < 3) phoneNumbers.push("");
  const phoneNumber = phoneNumbers[0];
  const phoneKeys = phoneNumbers.map(normalizePhone);
  const populatedPhoneKeys = phoneKeys.filter(Boolean);
  const phoneKey = phoneKeys[0];
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const city = typeof cityValue === "string" ? cityValue.trim() : "";
  const country = typeof countryValue === "string" && countryValue.trim() ? countryValue.trim().toUpperCase() : "TZ";
  const industry = typeof industryValue === "string" ? industryValue.trim() : "";
  if (!brandName || brandName.length > 180) return { error: "Enter a brand name (up to 180 characters)." };
  if (!/^\d{10}$/.test(phoneNumber)) return { error: "The first phone number is required and must be exactly 10 digits with no spaces or country code." };
  if (phoneNumbers.slice(1).some((phone) => phone !== "" && !/^\d{10}$/.test(phone))) return { error: "Each additional phone number must be exactly 10 digits with no spaces or country code." };
  if (new Set(populatedPhoneKeys).size !== populatedPhoneKeys.length) return { error: "Each phone number must be different." };
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Enter a valid email address." };
  if (city.length > 100) return { error: "City must be 100 characters or fewer." };
  if (!/^[A-Z]{2}$/.test(country)) return { error: "Enter a two-letter country code, such as TZ." };
  if (!industryOptions.includes(industry as (typeof industryOptions)[number])) return { error: "Choose an industry." };
  return { brandName, email, phoneNumber, phoneNumbers, city, country, industry, phoneKey, phoneKeys: populatedPhoneKeys };
}

async function ensureLeadNumbers(db = firestore()) {
  const collection = db.collection("leads");
  const counterRef = db.collection("systemCounters").doc("leadNumbers");
  await db.runTransaction(async (transaction) => {
    const counter = await transaction.get(counterRef);
    if (counter.exists && counter.get("initialized") === true) return;
    const snapshot = await transaction.get(collection);
    let maximum = Math.max(0, Number(counter.get("value") ?? 0));
    for (const doc of snapshot.docs) {
      const number = Number(doc.get("lead_number"));
      if (Number.isSafeInteger(number) && number > maximum) maximum = number;
    }
    const unnumbered = snapshot.docs.filter((doc) => !Number.isSafeInteger(Number(doc.get("lead_number"))));
    unnumbered.sort((a, b) => {
      const left = a.get("date_added") instanceof Timestamp ? a.get("date_added").toMillis() : 0;
      const right = b.get("date_added") instanceof Timestamp ? b.get("date_added").toMillis() : 0;
      return left - right || a.id.localeCompare(b.id);
    });
    for (const doc of unnumbered) transaction.update(doc.ref, { lead_number: ++maximum });
    if (snapshot.size || counter.exists) transaction.set(counterRef, { value: maximum, initialized: true });
  });
}

export async function listLeads() {
  const db = firestore();
  await ensureLeadNumbers(db);
  const snapshot = await db.collection("leads").get();
  const needsBackfill = snapshot.docs.filter((doc) => typeof doc.get("city") !== "string" || typeof doc.get("country") !== "string" || !String(doc.get("country") ?? "").trim() || typeof doc.get("phone_number") !== "string" || !Array.isArray(doc.get("phone_numbers")) || doc.get("whatsapp_number") !== undefined || doc.get("whatsapp_numbers") !== undefined || !industryOptions.includes(String(doc.get("industry") ?? "") as (typeof industryOptions)[number]));
  for (let offset = 0; offset < needsBackfill.length; offset += 450) {
    const batch = db.batch();
    for (const doc of needsBackfill.slice(offset, offset + 450)) {
      const data: Record<string, unknown> = {};
      if (typeof doc.get("city") !== "string") data.city = "";
      if (typeof doc.get("country") !== "string" || !String(doc.get("country") ?? "").trim()) data.country = "TZ";
      if (!industryOptions.includes(String(doc.get("industry") ?? "") as (typeof industryOptions)[number])) data.industry = "Other";
      const primary = typeof doc.get("phone_number") === "string" ? doc.get("phone_number") : typeof doc.get("whatsapp_number") === "string" ? doc.get("whatsapp_number") : "";
      const existingNumbers = Array.isArray(doc.get("phone_numbers")) ? doc.get("phone_numbers") : Array.isArray(doc.get("whatsapp_numbers")) ? doc.get("whatsapp_numbers") : [primary, "", ""];
      if (typeof doc.get("phone_number") !== "string") data.phone_number = primary;
      if (!Array.isArray(doc.get("phone_numbers"))) data.phone_numbers = [0, 1, 2].map((index) => typeof existingNumbers[index] === "string" ? existingNumbers[index] : "");
      if (doc.get("whatsapp_number") !== undefined) data.whatsapp_number = FieldValue.delete();
      if (doc.get("whatsapp_numbers") !== undefined) data.whatsapp_numbers = FieldValue.delete();
      if (Object.keys(data).length) batch.update(doc.ref, data);
    }
    await batch.commit();
  }
  return snapshot.docs.map((doc) => toLead(doc.id, doc.data()));
}

export async function findLeadByPhone(phoneKey: string) {
  const db = firestore();
  const index = await db.collection("leadPhoneIndex").doc(phoneKey).get();
  if (!index.exists) return null;
  const id = index.get("lead_id") as string;
  const lead = await db.collection("leads").doc(id).get();
  return lead.exists ? toLead(lead.id, lead.data()!) : null;
}

export async function createLead(input: LeadInput) {
  const db = firestore(); const id = randomUUID();
  await ensureLeadNumbers(db);
  const leadRef = db.collection("leads").doc(id);
  const indexRefs = input.phoneKeys.map((key) => db.collection("leadPhoneIndex").doc(key));
  const counterRef = db.collection("systemCounters").doc("leadNumbers");
  return db.runTransaction(async (transaction) => {
    const [counter, ...indexes] = await Promise.all([transaction.get(counterRef), ...indexRefs.map((ref) => transaction.get(ref))]);
    for (const index of indexes) {
      if (!index.exists) continue;
      const existingRef = db.collection("leads").doc(index.get("lead_id") as string);
      const existing = await transaction.get(existingRef);
      if (existing.exists) return { duplicate: toLead(existing.id, existing.data()!) };
    }
    const leadNumber = Number(counter.get("value") ?? 0) + 1;
    const now = Timestamp.now();
    for (const indexRef of indexRefs) transaction.set(indexRef, { lead_id: id });
    transaction.set(counterRef, { value: leadNumber, initialized: true });
    const newLead = { lead_number: leadNumber, brand_name: input.brandName, email: input.email, phone_number: input.phoneNumber, phone_numbers: input.phoneNumbers, city: input.city, country: input.country, industry: input.industry, phone_key: input.phoneKey, phone_keys: input.phoneKeys, status: "Cold", date_added: now, date_converted: null };
    transaction.set(leadRef, newLead);
    return { lead: toLead(id, newLead) };
  });
}

export async function updateLead(id: string, input: LeadInput) {
  const db = firestore(); const leadRef = db.collection("leads").doc(id);
  await ensureLeadNumbers(db);
  return db.runTransaction(async (transaction) => {
    const leadDoc = await transaction.get(leadRef);
    if (!leadDoc.exists) return { missing: true as const };
    const old = leadDoc.data()!;
    const oldPhoneKeys: string[] = Array.isArray(old.phone_keys) ? old.phone_keys : [typeof old.phone_key === "string" ? old.phone_key : normalizePhone(String(old.phone_number ?? old.whatsapp_number ?? ""))];
    const allKeys = [...new Set([...oldPhoneKeys, ...input.phoneKeys])];
    const indexRefs = allKeys.map((key) => db.collection("leadPhoneIndex").doc(key));
    const indexes = await Promise.all(indexRefs.map((ref) => transaction.get(ref)));
    const indexByKey = new Map(allKeys.map((key, index) => [key, indexes[index]]));
    for (const key of input.phoneKeys) {
      const newIndex = indexByKey.get(key)!;
      if (newIndex.exists && newIndex.get("lead_id") !== id) {
        const duplicateRef = db.collection("leads").doc(newIndex.get("lead_id") as string);
        const duplicate = await transaction.get(duplicateRef);
        if (duplicate.exists) return { duplicate: toLead(duplicate.id, duplicate.data()!) };
      }
    }
    for (const key of oldPhoneKeys) if (!input.phoneKeys.includes(key) && indexByKey.get(key)?.get("lead_id") === id) transaction.delete(indexByKey.get(key)!.ref);
    for (const key of input.phoneKeys) transaction.set(indexByKey.get(key)!.ref, { lead_id: id });
    const update = { brand_name: input.brandName, email: input.email, phone_number: input.phoneNumber, phone_numbers: input.phoneNumbers, city: input.city, country: input.country, industry: input.industry, phone_key: input.phoneKey, phone_keys: input.phoneKeys, whatsapp_number: FieldValue.delete(), whatsapp_numbers: FieldValue.delete() };
    const updated = { ...old, ...update };
    transaction.update(leadRef, update);
    return { lead: toLead(id, updated) };
  });
}

export async function changeLeadStatus(id: string, action: "convert" | "revert") {
  const db = firestore(); const ref = db.collection("leads").doc(id);
  await ensureLeadNumbers(db);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return { missing: true as const };
    const data = doc.data()!; const wanted = action === "convert" ? "Cold" : "Prospect";
    if (data.status !== wanted) return { conflict: true as const };
    const status = action === "convert" ? "Prospect" : "Cold";
    const dateConverted = action === "convert" ? Timestamp.now() : null;
    transaction.update(ref, { status, date_converted: dateConverted });
    return { lead: toLead(id, { ...data, status, date_converted: dateConverted }) };
  });
}

export async function deleteLead(id: string, confirmation: unknown) {
  const db = firestore(); const ref = db.collection("leads").doc(id);
  await ensureLeadNumbers(db);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return { missing: true as const };
    const data = doc.data()!;
    const prefix = data.status === "Prospect" ? "P" : "L";
    const expectedCode = `${prefix}${String(data.lead_number).padStart(5, "0")}`;
    if (confirmation !== expectedCode) return { confirmationMismatch: true as const };
    const keys: string[] = Array.isArray(data.phone_keys) ? data.phone_keys : [String(data.phone_key ?? normalizePhone(String(data.phone_number ?? data.whatsapp_number ?? "")))];
    const refs = keys.filter(Boolean).map((key) => db.collection("leadPhoneIndex").doc(key));
    const indexes = await Promise.all(refs.map((indexRef) => transaction.get(indexRef)));
    transaction.delete(ref);
    for (const index of indexes) if (index.exists && index.get("lead_id") === id) transaction.delete(index.ref);
    return { deleted: true as const };
  });
}
