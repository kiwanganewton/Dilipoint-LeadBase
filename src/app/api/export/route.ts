import { connection, NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listLeads } from "@/lib/db";

const sorts = new Set(["brand-asc", "brand-desc", "date-asc", "date-desc", "phone-asc", "phone-desc"]);

export async function GET(request: NextRequest) {
  await connection();
  try {
    const format = request.nextUrl.searchParams.get("format");
    if (format === "meta") {
      const leads = await listLeads();
      const audienceRows = leads.flatMap((lead) => {
        const normalizedPhones = lead.phone_numbers.slice(0, 3).map((value) => {
        let digits = value.replace(/\D/g, "");
        if (digits.startsWith("00")) digits = digits.slice(2);
        // Tanzania local numbers are commonly entered as 0XXXXXXXXX or 7XXXXXXXX.
        if (digits.startsWith("0")) digits = `255${digits.slice(1)}`;
        else if (/^[67]\d{8}$/.test(digits)) digits = `255${digits}`;
        return /^\d{7,15}$/.test(digits) ? digits : "";
        });
        if (!normalizedPhones[0]) return [];
        return [{ primaryPhone: normalizedPhones[0], secondaryPhone: normalizedPhones[1] ?? "", thirdPhone: normalizedPhones[2] ?? "", email: lead.email, ct: lead.city, country: lead.country || "TZ" }];
      });
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Dilipoint LeadBase"; workbook.created = new Date();
      const sheet = workbook.addWorksheet("Meta Audience");
      const headers = ["phone", "phone", "phone", "email", "ct", "country"];
      sheet.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 34 }, { width: 22 }, { width: 12 }];
      sheet.addRow(headers);
      for (const lead of audienceRows) sheet.addRow([lead.primaryPhone, lead.secondaryPhone, lead.thirdPhone, lead.email, lead.ct, lead.country]);
      const head = sheet.getRow(1); head.height = 24; head.font = { bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26374A" } }; head.alignment = { vertical: "middle", wrapText: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      for (let i = 2; i <= sheet.rowCount; i++) { const row = sheet.getRow(i); row.height = 30; row.eachCell((cell) => { cell.numFmt = "@"; cell.alignment = { vertical: "middle" }; }); }
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Meta_Audience_${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}.xlsx`;
      return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
    }
    const status = request.nextUrl.searchParams.get("status") === "Prospect" ? "Prospect" : "Cold";
    const requestedSort = request.nextUrl.searchParams.get("sort") ?? "brand-asc";
    const sort = sorts.has(requestedSort) ? requestedSort : "brand-asc";
    const rows = (await listLeads()).filter((lead) => lead.status === status).sort((a, b) => {
      const comparison = sort.startsWith("brand") ? a.brand_name.localeCompare(b.brand_name) : sort.startsWith("date") ? Date.parse(a.date_added) - Date.parse(b.date_added) : a.phone_number.replace(/\D/g, "").localeCompare(b.phone_number.replace(/\D/g, ""));
      return (sort.endsWith("desc") ? -comparison : comparison) || a.id.localeCompare(b.id);
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Dilipoint LeadBase"; workbook.created = new Date();
    const sheet = workbook.addWorksheet(status === "Cold" ? "Cold Leads" : "Prospects");
    const headers = status === "Cold" ? ["Lead ID", "Brand Name", "Email", "Phone Number 1", "Phone Number 2", "Phone Number 3", "Date Added", "Status"] : ["Lead ID", "Brand Name", "Email", "Phone Number 1", "Phone Number 2", "Phone Number 3", "Date Added", "Date Converted to Prospect", "Status"];
    sheet.addRow(headers);
    const valueFor = (row: typeof rows[number], header: string) => {
      if (header === "Lead ID") return `${status === "Cold" ? "L" : "P"}${String(row.lead_number).padStart(5, "0")}`;
      if (header === "Brand Name") return row.brand_name;
      if (header === "Email") return row.email;
      if (header.startsWith("Phone Number")) return row.phone_numbers[Number(header.slice(-1)) - 1] ?? "";
      if (header === "Date Added") return new Date(row.date_added);
      if (header === "Date Converted to Prospect") return row.date_converted ? new Date(row.date_converted) : "";
      return row.status;
    };
    for (const row of rows) {
      sheet.addRow(headers.map((header) => valueFor(row, header)));
    }
    sheet.columns.forEach((column, index) => {
      const header = headers[index];
      const longest = Math.max(header.length, ...rows.map((row) => String(valueFor(row, header)).length));
      column.width = header === "Lead ID" ? 14 : header === "Brand Name" ? Math.min(60, Math.max(20, longest + 2)) : header === "Email" ? 34 : header.startsWith("Phone Number") ? Math.min(32, Math.max(22, longest + 2)) : header === "Status" ? 14 : 25;
      column.alignment = { vertical: "middle", wrapText: header === "Brand Name" || header === "Email" };
    });
    const head = sheet.getRow(1); head.height = 24; head.font = { bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF26374A" } }; head.alignment = { vertical: "middle", wrapText: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    for (let i = 2; i <= sheet.rowCount; i++) { const row = sheet.getRow(i); row.height = 30; row.eachCell((cell, col) => { const header = headers[col - 1]; cell.alignment = { vertical: "middle", wrapText: header === "Brand Name" || header === "Email" }; if (header.startsWith("Phone Number")) cell.numFmt = "@"; if (header === "Date Added" || header === "Date Converted to Prospect") cell.numFmt = "dd mmm yyyy"; }); }
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${status === "Cold" ? "Cold_Leads" : "Prospects"}_${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}.xlsx`;
    return new NextResponse(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) { console.error("GET /api/export", error); return NextResponse.json({ error: "Export unavailable. Check the Firebase configuration." }, { status: 503 }); }
}
