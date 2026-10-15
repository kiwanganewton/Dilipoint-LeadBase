import { connection, NextRequest, NextResponse } from "next/server";
import { changeLeadStatus, deleteLead, updateLead, validateLead } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  await connection();
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (body.action === "convert" || body.action === "revert") {
      const result = await changeLeadStatus(id, body.action);
      if (result.missing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (result.conflict) return NextResponse.json({ error: "Lead not found or its status has changed. Refresh and try again." }, { status: 409 });
      return NextResponse.json({ lead: result.lead });
    }
    const valid = validateLead(body.brandName, body.whatsappNumber, body.email);
    if ("error" in valid) return NextResponse.json({ error: valid.error }, { status: 400 });
    const result = await updateLead(id, valid);
    if (result.missing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (result.duplicate) return NextResponse.json({ error: "This WhatsApp number already exists.", existing: result.duplicate }, { status: 409 });
    return NextResponse.json({ lead: result.lead });
  } catch (error) {
    console.error("PATCH /api/leads", error);
    return NextResponse.json({ error: "Could not update the lead. Check the Firebase configuration and try again." }, { status: 503 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  await connection();
  try {
    const { id } = await context.params;
    if (!await deleteLead(id)) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/leads", error);
    return NextResponse.json({ error: "Could not delete the lead. Check the Firebase configuration and try again." }, { status: 503 });
  }
}
