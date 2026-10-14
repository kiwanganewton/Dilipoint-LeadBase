import { connection, NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listLeads } from "@/lib/db";

const sorts = new Set(["brand-asc", "brand-desc", "date-asc", "date-desc", "phone-asc", "phone-desc"]);

export async function GET(request: NextRequest) {
  await connection();
  try {
    const status = request.nextUrl.searchParams.get("status") === "Prospect" ? "Prospect" : "Cold";
    const requestedSort = request.nextUrl.searchParams.get("sort") ?? "brand-asc";
    const sort = sorts.has(requestedSort) ? requestedSort : "brand-asc";
    const rows = (await listLeads()).filter((lead) => lead.status === status).sort((a, b) => {
      const comparison = sort.startsWith("brand") ? a.brand_name.localeCompare(b.brand_name) : sort.startsWith("date") ? Date.parse(a.date_added) - Date.parse(b.date_added) : a.whatsapp_number.replace(/\D/g, "").localeCompare(b.whatsapp_number.replace(/\D/g, ""));
      return (sort.endsWith("desc") ? -comparison : comparison) || a.id.localeCompare(b.id);
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Dilipoint LeadBase"; workbook.created = new Date();
    const sheet = workbook.addWorksheet(status === "Cold" ? "Cold Leads" : "Prospects");
    const headers = status === "Cold" ? ["Brand Name", "WhatsApp Number", "Date Added", "Status"] : ["Brand Name", "WhatsApp Number", "Date Added", "Date Converted to Prospect", "Status"];
    sheet.addRow(headers);
    for (const row of rows) {
      const date = (value: string | Date | null) => value ? new Date(value) : "";
      sheet.addRow(status === "Cold" ? [row.brand_name, row.whatsapp_number, date(row.date_added), row.status] : [row.brand_name, row.whatsapp_number, date(row.date_added), date(row.date_converted), row.status]);
    }
    sheet.columns.forEach((column, index) => {
      const longest = Math.max(headers[index].length, ...rows.map((r) => String(index === 0 ? r.brand_name : index === 1 ? r.whatsapp_number : "").length));
      column.width = index === 0 ? Math.min(60, Math.max(20, longest + 2)) : index === 1 ? Math.min(32, Math.max(22, longest + 2)) : index === headers.length - 1 ? 14 : 24;
      column.alignment = { vertical: "middle", wrapText: index === 0 };
    });
    const head = sheet.getRow(1); head.height = 24; head.font = { bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26374A" } }; head.alignment = { vertical: "middle", wrapText: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    for (let i = 2; i <= sheet.rowCount; i++) { const row = sheet.getRow(i); row.height = 30; row.eachCell((cell, col) => { cell.alignment = { vertical: "middle", wrapText: col === 1 }; if (col === 2) cell.numFmt = "@"; if (col === 3 || (status === "Prospect" && col === 4)) cell.numFmt = "dd mmm yyyy"; }); }
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${status === "Cold" ? "Cold_Leads" : "Prospects"}_${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}.xlsx`;
    return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) { console.error("GET /api/export", error); return NextResponse.json({ error: "Export unavailable. Check the Firebase configuration." }, { status: 503 }); }
}
