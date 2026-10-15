import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

export type Lead = { id: string; brand_name: string; email: string; whatsapp_number: string; status: "Cold" | "Prospect"; date_added: string; date_converted: string | null };
type LeadInput = { brandName: string; email: string; whatsappNumber: string; phoneKey: string };

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
  return { id, brand_name: data.brand_name, email: typeof data.email === "string" ? data.email : "", whatsapp_number: data.whatsapp_number, status: data.status, date_added: iso(data.date_added) ?? new Date(0).toISOString(), date_converted: iso(data.date_converted) };
}

export function normalizePhone(value: string) { return value.replace(/\D/g, ""); }

export function validateLead(brand: unknown, phone: unknown, emailValue?: unknown) {
  const brandName = typeof brand === "string" ? brand.trim() : "";
  const whatsappNumber = typeof phone === "string" ? phone.trim() : "";
  const phoneKey = normalizePhone(whatsappNumber);
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  if (!brandName || brandName.length > 180) return { error: "Enter a brand name (up to 180 characters)." };
  if (phoneKey.length < 7 || phoneKey.length > 15) return { error: "Enter a valid phone number with 7 to 15 digits." };
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Enter a valid email address." };
  return { brandName, email, whatsappNumber, phoneKey };
}

export async function listLeads() {
  const snapshot = await firestore().collection("leads").get();
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
  const leadRef = db.collection("leads").doc(id); const indexRef = db.collection("leadPhoneIndex").doc(input.phoneKey);
  return db.runTransaction(async (transaction) => {
    const index = await transaction.get(indexRef);
    if (index.exists) {
      const existingRef = db.collection("leads").doc(index.get("lead_id") as string);
      const existing = await transaction.get(existingRef);
      if (existing.exists) return { duplicate: toLead(existing.id, existing.data()!) };
    }
    const now = Timestamp.now();
    transaction.set(indexRef, { lead_id: id });
    transaction.set(leadRef, { brand_name: input.brandName, email: input.email, whatsapp_number: input.whatsappNumber, phone_key: input.phoneKey, status: "Cold", date_added: now, date_converted: null });
    return { lead: toLead(id, { brand_name: input.brandName, email: input.email, whatsapp_number: input.whatsappNumber, status: "Cold", date_added: now, date_converted: null }) };
  });
}

export async function updateLead(id: string, input: LeadInput) {
  const db = firestore(); const leadRef = db.collection("leads").doc(id); const newIndexRef = db.collection("leadPhoneIndex").doc(input.phoneKey);
  return db.runTransaction(async (transaction) => {
    const leadDoc = await transaction.get(leadRef);
    if (!leadDoc.exists) return { missing: true as const };
    const old = leadDoc.data()!; const oldKey = old.phone_key as string;
    const newIndex = await transaction.get(newIndexRef);
    if (newIndex.exists && newIndex.get("lead_id") !== id) {
      const duplicateRef = db.collection("leads").doc(newIndex.get("lead_id") as string);
      const duplicate = await transaction.get(duplicateRef);
      if (duplicate.exists) return { duplicate: toLead(duplicate.id, duplicate.data()!) };
    }
    if (oldKey !== input.phoneKey) {
      transaction.delete(db.collection("leadPhoneIndex").doc(oldKey));
      transaction.set(newIndexRef, { lead_id: id });
    } else if (!newIndex.exists) transaction.set(newIndexRef, { lead_id: id });
    const updated = { ...old, brand_name: input.brandName, email: input.email, whatsapp_number: input.whatsappNumber, phone_key: input.phoneKey };
    transaction.update(leadRef, { brand_name: input.brandName, email: input.email, whatsapp_number: input.whatsappNumber, phone_key: input.phoneKey });
    return { lead: toLead(id, updated) };
  });
}

export async function changeLeadStatus(id: string, action: "convert" | "revert") {
  const db = firestore(); const ref = db.collection("leads").doc(id);
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

export async function deleteLead(id: string) {
  const db = firestore(); const ref = db.collection("leads").doc(id);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return false;
    const key = doc.get("phone_key") as string;
    const indexRef = db.collection("leadPhoneIndex").doc(key);
    const index = await transaction.get(indexRef);
    transaction.delete(ref);
    if (index.exists && index.get("lead_id") === id) transaction.delete(indexRef);
    return true;
  });
}
