import { connection, NextRequest, NextResponse } from "next/server";
import { createLead, findLeadByPhone, listLeads, validateLead } from "@/lib/db";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const phone = request.nextUrl.searchParams.get("phone");
    if (phone !== null) {
      const existing = await findLeadByPhone(phone.replace(/\D/g, ""));
      return NextResponse.json({ available: !existing, existing });
    }
    const status = request.nextUrl.searchParams.get("status");
    const leads = await listLeads();
    return NextResponse.json({ leads: status === "Cold" || status === "Prospect" ? leads.filter((lead) => lead.status === status) : leads });
  } catch (error) {
    console.error("GET /api/leads", error);
    return NextResponse.json({ error: "Firebase unavailable. Check your Firebase Admin environment settings." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();
    const valid = validateLead(body.brandName, body.whatsappNumber, body.email);
    if ("error" in valid) return NextResponse.json({ error: valid.error }, { status: 400 });
    const result = await createLead(valid);
    if (result.duplicate) return NextResponse.json({ error: "This WhatsApp number already exists.", existing: result.duplicate }, { status: 409 });
    return NextResponse.json({ lead: result.lead }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads", error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    const message = process.env.NODE_ENV === "development"
      ? code === "5" || code === "NOT_FOUND"
        ? "Firestore returned NOT_FOUND. Create the (default) Firestore database in the Firebase project set by FIREBASE_PROJECT_ID, then restart the dev server. If it already exists, check the server terminal for the exact resource error."
        : `Could not save the lead (Firebase error: ${code}). Check the server terminal for details.`
      : "Could not save the lead. Check the Firebase configuration and try again.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
