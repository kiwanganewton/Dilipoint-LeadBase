"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Lead = { id: string; brand_name: string; whatsapp_number: string; status: "Cold" | "Prospect"; date_added: string; date_converted: string | null };
type Sort = "brand-asc" | "brand-desc" | "date-asc" | "date-desc" | "phone-asc" | "phone-desc";
const sortOptions: { value: Sort; label: string }[] = [
  { value: "brand-asc", label: "Brand name: A to Z" }, { value: "brand-desc", label: "Brand name: Z to A" },
  { value: "date-asc", label: "Date added: Oldest first" }, { value: "date-desc", label: "Date added: Newest first" },
  { value: "phone-asc", label: "WhatsApp: Ascending" }, { value: "phone-desc", label: "WhatsApp: Descending" },
];
const navItems = ["Dashboard", "Add New Lead", "Cold Leads", "Prospects", "Downloads / Export"] as const;
type Page = (typeof navItems)[number];
type IconName = "dashboard" | "plus" | "clock" | "users" | "download" | "target" | "trend" | "chevron-left" | "chevron-right" | "chevron-down" | "menu" | "close" | "search" | "sort" | "arrow-right" | "file" | "edit" | "trash" | "check" | "rotate" | "alert";
const icons: Record<Page, IconName> = { Dashboard: "dashboard", "Add New Lead": "plus", "Cold Leads": "clock", Prospects: "users", "Downloads / Export": "download" };
const niceDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let shape: React.ReactNode;
  switch (name) {
    case "dashboard": shape = <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>; break;
    case "plus": shape = <path d="M12 5v14M5 12h14"/>; break;
    case "clock": shape = <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>; break;
    case "users": shape = <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>; break;
    case "download": shape = <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></>; break;
    case "target": shape = <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></>; break;
    case "trend": shape = <><path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/></>; break;
    case "chevron-left": shape = <path d="m15 18-6-6 6-6"/>; break;
    case "chevron-right": shape = <path d="m9 18 6-6-6-6"/>; break;
    case "chevron-down": shape = <path d="m6 9 6 6 6-6"/>; break;
    case "menu": shape = <><path d="M4 6h16M4 12h16M4 18h16"/></>; break;
    case "close": shape = <><path d="m18 6-12 12M6 6l12 12"/></>; break;
    case "search": shape = <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>; break;
    case "sort": shape = <><path d="m8 7 4-4 4 4M12 3v18m4-4-4 4-4-4"/></>; break;
    case "arrow-right": shape = <><path d="M5 12h14M13 6l6 6-6 6"/></>; break;
    case "file": shape = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>; break;
    case "edit": shape = <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></>; break;
    case "trash": shape = <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></>; break;
    case "check": shape = <path d="m5 12 4 4L19 6"/>; break;
    case "rotate": shape = <><path d="M3 12a9 9 0 0 1 15-6l2 2"/><path d="M20 4v4h-4M21 12a9 9 0 0 1-15 6l-2-2"/><path d="M4 20v-4h4"/></>; break;
    case "alert": shape = <><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></>; break;
  }
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>{shape}</svg>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("brand-asc");
  const [pageIndex, setPageIndex] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load leads.");
      setLeads(data.leads); setLoadError("");
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Unable to connect to Firebase."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  useEffect(() => { const timer = setTimeout(() => setNow(new Date()), 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4200); return () => clearTimeout(t); }, [notice]);

  const cold = leads.filter((lead) => lead.status === "Cold");
  const prospects = leads.filter((lead) => lead.status === "Prospect");
  const today = now ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now) : "";
  const addedToday = leads.filter((lead) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(lead.date_added)) === today).length;
  const listStatus = page === "Cold Leads" ? "Cold" : "Prospect";
  const visible = useMemo(() => {
    if (page !== "Cold Leads" && page !== "Prospects") return [];
    const source = leads.filter((lead) => lead.status === listStatus).filter((lead) => `${lead.brand_name} ${lead.whatsapp_number}`.toLowerCase().includes(search.toLowerCase().trim()));
    source.sort((a, b) => {
      const cmp = sort.startsWith("brand") ? a.brand_name.localeCompare(b.brand_name) : sort.startsWith("date") ? Date.parse(a.date_added) - Date.parse(b.date_added) : a.whatsapp_number.replace(/\D/g, "").localeCompare(b.whatsapp_number.replace(/\D/g, ""));
      return (sort.endsWith("desc") ? -cmp : cmp) || a.id.localeCompare(b.id);
    });
    return source;
  }, [leads, listStatus, page, search, sort]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const shown = visible.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  async function changeStatus(lead: Lead) {
    const toProspect = lead.status === "Cold";
    if (!window.confirm(toProspect ? `Mark ${lead.brand_name} as replied and move it to Prospects?` : `Move ${lead.brand_name} back to Cold Leads?`)) return;
    try {
      const response = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: toProspect ? "convert" : "revert" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setNotice({ text: toProspect ? "Lead moved to Prospects." : "Prospect moved back to Cold Leads.", type: "success" }); await refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not update status.", type: "error" }); }
  }
  async function deleteLead(lead: Lead) {
    if (!window.confirm(`Delete ${lead.brand_name}? This action cannot be undone.`)) return;
    try { const r = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setNotice({ text: "Lead deleted.", type: "success" }); await refresh(); }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not delete lead.", type: "error" }); }
  }
  function openAdd() { setEditLead(null); setFormOpen(true); }
  async function startExport(status: "Cold" | "Prospect") {
    try {
      const response = await fetch(`/api/export?status=${status}&sort=${sort}`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Export failed."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${status === "Cold" ? "Cold_Leads" : "Prospects"}_${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Export failed.", type: "error" }); }
  }

  function navigate(item: Page) {
    if (item === "Add New Lead") openAdd();
    else setPage(item);
    setMobileSidebarOpen(false);
  }

  return <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileSidebarOpen ? "mobile-sidebar-open" : ""}`}>
    {mobileSidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)}/>}
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">L</div><div className="brand-copy"><strong>LeadBase</strong><span>by dilipoint</span></div><button className="sidebar-collapse-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}><Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} size={16}/></button><button className="mobile-sidebar-close" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)}><Icon name="close" size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map((item) => <button key={item} className={`nav-item ${page === item ? "active" : ""}`} aria-label={item} onClick={() => navigate(item)}><span className="nav-icon"><Icon name={icons[item]}/></span><span className="nav-text">{item}</span>{item === "Cold Leads" && <span className="nav-count">{cold.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-line"/><div className="workspace-user"><div className="workspace-avatar">D</div><div><b>Dilipoint</b><span>Lead workspace</span></div><span className="dots">···</span></div></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><button className="mobile-nav-toggle" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}><Icon name="menu" size={19}/></button><div className="crumb"><span className="crumb-workspace">Workspace</span><span className="crumb-separator">/</span> <b>{page === "Dashboard" ? "Overview" : page}</b></div><div className="top-actions"><span className={`today-pill ${loadError ? "offline" : ""}`}><i/> {loadError ? "Not connected" : "All data synced"}</span><button className="top-add" onClick={openAdd}><Icon name="plus" size={16}/><span className="top-add-label">Add new lead</span></button><div className="top-avatar">D</div></div></header>
      <div className="content">
        {loadError && <div className="db-warning"><span><Icon name="alert" size={18}/></span><div><b>Firebase connection required</b><p>{loadError} Add your Firebase Admin credentials to <code>.env.local</code>. See README for setup.</p></div><button onClick={() => void refresh()}>Retry</button></div>}
        {page === "Dashboard" && <Dashboard now={now} cold={cold.length} prospects={prospects.length} total={leads.length} today={addedToday} onAdd={openAdd} onExport={startExport} onNavigate={setPage}/>}
        {(page === "Cold Leads" || page === "Prospects") && <>
          <div className="page-heading"><div><div className="eyebrow">LEAD MANAGEMENT</div><h1>{page}</h1><p>{page === "Cold Leads" ? "Keep track of new contacts and follow up when they reply." : "Your replied leads, ready for the next conversation."}</p></div><button className="button-primary" onClick={openAdd}><Icon name="plus" size={16}/> Add new lead</button></div>
          <div className="list-summary"><div className="summary-left"><span className={`summary-dot ${listStatus.toLowerCase()}`}/><b>{visible.length}</b><span>{listStatus === "Cold" ? "cold leads" : "prospects"}</span></div><div className="list-controls"><label className="search-box"><Icon name="search" size={17}/><input aria-label="Search leads" placeholder="Search by brand or number..." value={search} onChange={(e) => { setSearch(e.target.value); setPageIndex(1); }}/></label><label className="sort-box"><Icon name="sort" size={16}/><select aria-label="Sort leads" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPageIndex(1); }}>{sortOptions.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label></div></div>
          <LeadTable leads={shown} status={listStatus} loading={loading} onStatus={changeStatus} onEdit={(lead) => { setEditLead(lead); setFormOpen(true); }} onDelete={deleteLead}/>
          <div className="pagination"><span>Showing <b>{visible.length ? (pageIndex - 1) * pageSize + 1 : 0}–{Math.min(pageIndex * pageSize, visible.length)}</b> of <b>{visible.length}</b> {listStatus.toLowerCase()} leads</span><div className="page-buttons"><button aria-label="Previous page" disabled={pageIndex <= 1} onClick={() => setPageIndex((p) => p - 1)}><Icon name="chevron-left" size={16}/><span>Previous</span></button><span className="page-number">{pageIndex} / {totalPages}</span><button aria-label="Next page" disabled={pageIndex >= totalPages} onClick={() => setPageIndex((p) => p + 1)}><span>Next</span><Icon name="chevron-right" size={16}/></button></div></div>
        </>}
        {page === "Add New Lead" && <div className="page-heading"><div><div className="eyebrow">LEAD MANAGEMENT</div><h1>Add New Lead</h1><p>Enter a brand and WhatsApp number to check availability.</p></div><button className="button-primary" onClick={openAdd}><Icon name="plus" size={16}/> Add new lead</button></div>}
        {page === "Downloads / Export" && <ExportPanel onExport={startExport} cold={cold.length} prospects={prospects.length}/>}
      </div>
      <footer className="footer"><span>© 2026 Dilipoint LeadBase</span><span>Simple, organized lead management</span></footer>
    </section>
    {formOpen && <LeadDialog initial={editLead} onClose={() => setFormOpen(false)} onSaved={async (text) => { setFormOpen(false); setNotice({ text, type: "success" }); await refresh(); }}/>}
    {notice && <div role="status" className={`toast ${notice.type}`}><span><Icon name={notice.type === "success" ? "check" : "alert"} size={15}/></span>{notice.text}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}><Icon name="close" size={17}/></button></div>}
  </main>;
}

function Dashboard({ now, cold, prospects, total, today, onAdd, onExport, onNavigate }: { now: Date | null; cold: number; prospects: number; total: number; today: number; onAdd: () => void; onExport: (s: "Cold" | "Prospect") => void; onNavigate: (p: Page) => void }) {
  const currentDate = now ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(now).toUpperCase() : "TODAY";
  const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(now)) : 12;
  return <>
    <div className="welcome-row"><div><div className="eyebrow">{currentDate}</div><h1>Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}<span className="wave">,</span> Dilipoint</h1><p>Here’s what’s happening with your leads today.</p></div></div>
    <div className="stats-grid"><Stat icon="target" label="Total leads" value={total} change="Across all statuses" tone="blue"/><Stat icon="clock" label="Cold leads" value={cold} change="Waiting for a reply" tone="amber"/><Stat icon="users" label="Prospects" value={prospects} change="Replied and interested" tone="green"/><Stat icon="trend" label="Added today" value={today} change="New contacts today" tone="violet"/></div>
    <div className="dashboard-grid"><section className="panel overview-panel"><div className="panel-head"><div><h2>Lead overview</h2><p>A quick look at your current pipeline</p></div><span className="period-badge">All time <Icon name="chevron-down" size={13}/></span></div><div className="overview-content"><div className="donut-wrap"><div className="donut" style={{ "--cold": `${total ? (cold / total) * 100 : 0}%` } as React.CSSProperties}><div><strong>{total}</strong><span>Total leads</span></div></div></div><div className="legend"><div><span className="legend-dot cold"/><div><b>Cold leads</b><small>Not replied yet</small></div><strong>{cold}</strong></div><div><span className="legend-dot prospect"/><div><b>Prospects</b><small>Replied and interested</small></div><strong>{prospects}</strong></div><div className="legend-total"><span>Conversion rate</span><b>{total ? Math.round((prospects / total) * 100) : 0}%</b></div></div></div><div className="panel-foot"><span><i className="green-indicator"/> Live database totals</span><button onClick={() => onNavigate("Cold Leads")}>View cold leads <Icon name="arrow-right" size={15}/></button></div></section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common tasks, right at your fingertips</p></div></div><button className="quick-action" onClick={onAdd}><span className="quick-icon add"><Icon name="plus"/></span><span><b>Add a new lead</b><small>Check a number and save a contact</small></span><Icon name="arrow-right" size={17}/></button><button className="quick-action" onClick={() => onNavigate("Cold Leads")}><span className="quick-icon view"><Icon name="clock"/></span><span><b>Review cold leads</b><small>Pick up where your team left off</small></span><Icon name="arrow-right" size={17}/></button><button className="quick-action" onClick={() => onNavigate("Downloads / Export")}><span className="quick-icon download"><Icon name="download"/></span><span><b>Export your data</b><small>Download a formatted Excel file</small></span><Icon name="arrow-right" size={17}/></button></section></div>
    <ExportPanel onExport={onExport} cold={cold} prospects={prospects}/>
  </>;
}
function Stat({ icon, label, value, change, tone }: { icon: IconName; label: string; value: number; change: string; tone: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><i className={`stat-icon ${tone}`}><Icon name={icon} size={17}/></i></div><strong>{value.toLocaleString()}</strong><small>{change}</small></div>; }

function ExportPanel({ onExport, cold, prospects }: { onExport: (s: "Cold" | "Prospect") => void; cold: number; prospects: number }) { return <section className="export-panel"><div className="export-copy"><span className="export-icon"><Icon name="download" size={19}/></span><div><h2>Downloads / Export</h2><p>Download all records as a formatted Excel workbook.</p></div></div><div className="export-buttons"><button onClick={() => onExport("Cold")}><span className="file-icon"><Icon name="file" size={17}/></span><span><b>Cold leads</b><small>{cold} records · .xlsx</small></span><Icon name="download" size={16}/></button><button onClick={() => onExport("Prospect")}><span className="file-icon"><Icon name="file" size={17}/></span><span><b>Prospects</b><small>{prospects} records · .xlsx</small></span><Icon name="download" size={16}/></button></div></section>; }

function LeadTable({ leads, status, loading, onStatus, onEdit, onDelete }: { leads: Lead[]; status: "Cold" | "Prospect"; loading: boolean; onStatus: (lead: Lead) => void; onEdit: (lead: Lead) => void; onDelete: (lead: Lead) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>BRAND NAME</th><th>WHATSAPP NUMBER</th><th>DATE ADDED</th>{status === "Prospect" && <th>CONVERTED</th>}<th>STATUS</th><th className="action-heading">ACTIONS</th></tr></thead><tbody>
    {loading && <tr><td colSpan={status === "Prospect" ? 6 : 5} className="empty-cell">Loading leads…</td></tr>}
    {!loading && leads.map((lead) => <tr key={lead.id}><td><div className="brand-cell"><span className="brand-initial">{lead.brand_name.trim().charAt(0).toUpperCase()}</span><b>{lead.brand_name}</b></div></td><td><span className="phone-cell">{lead.whatsapp_number}</span></td><td>{niceDate(lead.date_added)}</td>{status === "Prospect" && <td>{lead.date_converted ? niceDate(lead.date_converted) : "—"}</td>}<td><span className={`status-badge ${status.toLowerCase()}`}><i/>{status}</span></td><td><div className="row-actions"><button className={status === "Cold" ? "reply-button" : "revert-button"} onClick={() => onStatus(lead)}><Icon name={status === "Cold" ? "check" : "rotate"} size={14}/>{status === "Cold" ? "Mark replied" : "Move to cold"}</button><button className="icon-button" aria-label={`Edit ${lead.brand_name}`} title="Edit" onClick={() => onEdit(lead)}><Icon name="edit" size={14}/></button><button className="icon-button delete-icon" aria-label={`Delete ${lead.brand_name}`} title="Delete" onClick={() => onDelete(lead)}><Icon name="trash" size={14}/></button></div></td></tr>)}
    {!loading && leads.length === 0 && <tr><td colSpan={status === "Prospect" ? 6 : 5} className="empty-cell"><div className="empty-symbol"><Icon name="search" size={23}/></div><b>No {status.toLowerCase()} leads found</b><span>Try another search, or add a new lead to get started.</span></td></tr>}
  </tbody></table></div>;
}

function LeadDialog({ initial, onClose, onSaved }: { initial: Lead | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [brand, setBrand] = useState(initial?.brand_name ?? ""); const [phone, setPhone] = useState(initial?.whatsapp_number ?? "");
  const [availability, setAvailability] = useState<{ available: boolean; existing?: { brand_name: string; whatsapp_number: string; status: string } } | null>(null);
  const [checking, setChecking] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (initial || phone.replace(/\D/g, "").length < 7) return; let active = true; const timer = setTimeout(async () => { setChecking(true); try { const r = await fetch(`/api/leads?phone=${encodeURIComponent(phone)}`); const data = await r.json(); if (active && r.ok) setAvailability(data); } catch { if (active) setAvailability(null); } finally { if (active) setChecking(false); } }, 350); return () => { active = false; clearTimeout(timer); }; }, [phone, initial]);
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); setError(""); try { const url = initial ? `/api/leads/${initial.id}` : "/api/leads"; const r = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandName: brand, whatsappNumber: phone }) }); const data = await r.json(); if (!r.ok) { const existing = data.existing; setAvailability(existing ? { available: false, existing } : availability); throw new Error(data.error || "Could not save lead."); } onSaved(initial ? "Lead details updated." : "Lead added to Cold Leads."); } catch (err) { setError(err instanceof Error ? err.message : "Could not save lead."); } finally { setSaving(false); } }
  const blocked = !initial && (checking || availability?.available === false);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div className="modal-title-icon"><Icon name={initial ? "edit" : "plus"} size={17}/></div><div><h2 id="modal-title">{initial ? "Edit lead" : "Add a new lead"}</h2><p>{initial ? "Update the brand or WhatsApp number." : "Check the number, then add a new contact."}</p></div><button aria-label="Close" className="modal-close" onClick={onClose}><Icon name="close" size={18}/></button></div><form onSubmit={submit} className="lead-form"><label>Brand name <span>*</span><input autoFocus maxLength={180} placeholder="e.g. Acme Studio" value={brand} onChange={(e) => setBrand(e.target.value)} required/></label><label>WhatsApp number <span>*</span><input placeholder="e.g. +255 712 345 678" value={phone} onChange={(e) => { setPhone(e.target.value); setAvailability(null); }} required/><small>Include country code for international numbers.</small></label>
    {!initial && checking && <div className="availability checking"><Icon name="search" size={15}/> Checking this number…</div>}
    {!initial && availability?.available && <div className="availability available"><b><Icon name="check" size={15}/> WhatsApp number is available.</b><span>You can safely add this lead.</span></div>}
    {!initial && availability?.available === false && <div className="availability duplicate"><b><Icon name="alert" size={15}/> This WhatsApp number already exists.</b>{availability.existing && <span>Existing record: <strong>{availability.existing.brand_name}</strong> · {availability.existing.whatsapp_number} · {availability.existing.status}</span>}</div>}
    {error && <div className="form-error">{error}</div>}<div className="form-note"><Icon name="clock" size={15}/> New leads are added with <b>Cold</b> status.</div><div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary" disabled={saving || blocked}>{saving ? "Saving…" : initial ? "Save changes" : "Add lead"}</button></div></form></section></div>;
}
