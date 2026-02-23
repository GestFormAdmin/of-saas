import JSZip from "jszip";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseFromRequest(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : null;

  // Client Supabase avec le token utilisateur (=> RLS respectée)
  const sb = createClient(url, anon, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { sb, token };
}

function toCsv(rows: any[]) {
  const arr = Array.isArray(rows) ? rows : [];
  if (arr.length === 0) return "";
  const headers = Object.keys(arr[0] ?? {});
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    const needs = /[",\n;]/.test(s);
    const safe = s.replace(/"/g, '""');
    return needs ? `"${safe}"` : safe;
  };
  const lines = [
    headers.join(";"),
    ...arr.map((r) => headers.map((h) => escape((r as any)[h])).join(";")),
  ];
  return lines.join("\n");
}

function addSheet(wb: ExcelJS.Workbook, name: string, rows: any[]) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  const arr = Array.isArray(rows) ? rows : [];
  if (arr.length === 0) {
    ws.addRow(["(vide)"]);
    return;
  }
  const headers = Object.keys(arr[0] ?? {});
  ws.addRow(headers);
  for (const r of arr) ws.addRow(headers.map((h) => (r as any)[h] ?? ""));
  ws.getRow(1).font = { bold: true };
  ws.columns?.forEach((c) => (c.width = Math.min(48, Math.max(12, (c.header?.toString().length ?? 12) + 2))));
}

async function fetchAll(sb: any) {
  // user
  const { data: userRes, error: userErr } = await sb.auth.getUser();
  if (userErr || !userRes?.user) throw new Error("NOT_AUTH");
  const userId = userRes.user.id;

  // org courant (chez toi ça existe déjà)
  const { data: orgId, error: orgErr } = await sb.rpc("current_org_id");
  const currentOrgId = orgErr ? null : (orgId as string | null);

  // PROFILE
  const { data: profile } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();

  // MEMBERSHIPS (pour infos rôle/org)
  const { data: memberships } = await sb.from("memberships").select("*").eq("user_id", userId);

  // Si pas d’org sélectionnée, export “user only”
  if (!currentOrgId) {
    return {
      meta: { userId, orgId: null },
      profile: profile ? [profile] : [],
      memberships: memberships ?? [],
      sessions: [],
      apprenants: [],
      clients: [],
      products: [],
      factures: [],
      invoices: [],
      expenses: [],
      apprenant_sessions: [],
      session_learners: [],
      session_attendees: [],
      documents: [],
      rgpd_documents: [],
    };
  }

  // ORG DATA (filtrée org_id)
  const [{ data: sessions }, { data: apprenants }, { data: clients }, { data: products }, { data: factures }, { data: invoices }, { data: expenses }] =
    await Promise.all([
      sb.from("sessions").select("*").eq("org_id", currentOrgId),
      sb.from("apprenants").select("*").eq("org_id", currentOrgId),
      sb.from("clients").select("*").eq("org_id", currentOrgId),
      sb.from("products").select("*").eq("org_id", currentOrgId),
      sb.from("factures").select("*").eq("org_id", currentOrgId),
      sb.from("invoices").select("*").eq("org_id", currentOrgId),
      sb.from("expenses").select("*").eq("org_id", currentOrgId),
    ]);

  // Tables “liaisons” si elles ont org_id (chez toi apprenant_sessions oui)
  const { data: apprenant_sessions } = await sb.from("apprenant_sessions").select("*").eq("org_id", currentOrgId);

  // Autres tables possibles (si elles ont org_id chez toi, sinon ça renverra vide si RLS bloque)
  const { data: session_learners } = await sb.from("session_learners").select("*").eq("org_id", currentOrgId);
  const { data: session_attendees } = await sb.from("session_attendees").select("*").eq("org_id", currentOrgId);

  const { data: documents } = await sb.from("documents").select("*").eq("org_id", currentOrgId);
  const { data: rgpd_documents } = await sb.from("rgpd_documents").select("*").eq("org_id", currentOrgId);

  return {
    meta: { userId, orgId: currentOrgId },
    profile: profile ? [profile] : [],
    memberships: memberships ?? [],
    sessions: sessions ?? [],
    apprenants: apprenants ?? [],
    clients: clients ?? [],
    products: products ?? [],
    factures: factures ?? [],
    invoices: invoices ?? [],
    expenses: expenses ?? [],
    apprenant_sessions: apprenant_sessions ?? [],
    session_learners: session_learners ?? [],
    session_attendees: session_attendees ?? [],
    documents: documents ?? [],
    rgpd_documents: rgpd_documents ?? [],
  };
}

export async function GET(req: Request) {
  try {
    const { sb } = getSupabaseFromRequest(req);

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "xlsx").toLowerCase(); // xlsx | csv

    const all = await fetchAll(sb);

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "OF SaaS";
      wb.created = new Date();

      addSheet(wb, "meta", [all.meta]);
      addSheet(wb, "profile", all.profile);
      addSheet(wb, "memberships", all.memberships);

      addSheet(wb, "sessions", all.sessions);
      addSheet(wb, "apprenants", all.apprenants);
      addSheet(wb, "clients", all.clients);
      addSheet(wb, "products", all.products);
      addSheet(wb, "factures", all.factures);
      addSheet(wb, "invoices", all.invoices);
      addSheet(wb, "expenses", all.expenses);

      addSheet(wb, "apprenant_sessions", all.apprenant_sessions);
      addSheet(wb, "session_learners", all.session_learners);
      addSheet(wb, "session_attendees", all.session_attendees);

      addSheet(wb, "documents", all.documents);
      addSheet(wb, "rgpd_documents", all.rgpd_documents);

      const buf = await wb.xlsx.writeBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="export-mes-donnees.xlsx"`,
        },
      });
    }

    // CSV = un ZIP avec plusieurs fichiers CSV
    const zip = new JSZip();
    zip.file("meta.csv", toCsv([all.meta]));
    zip.file("profile.csv", toCsv(all.profile));
    zip.file("memberships.csv", toCsv(all.memberships));

    zip.file("sessions.csv", toCsv(all.sessions));
    zip.file("apprenants.csv", toCsv(all.apprenants));
    zip.file("clients.csv", toCsv(all.clients));
    zip.file("products.csv", toCsv(all.products));
    zip.file("factures.csv", toCsv(all.factures));
    zip.file("invoices.csv", toCsv(all.invoices));
    zip.file("expenses.csv", toCsv(all.expenses));

    zip.file("apprenant_sessions.csv", toCsv(all.apprenant_sessions));
    zip.file("session_learners.csv", toCsv(all.session_learners));
    zip.file("session_attendees.csv", toCsv(all.session_attendees));

    zip.file("documents.csv", toCsv(all.documents));
    zip.file("rgpd_documents.csv", toCsv(all.rgpd_documents));

    const buf = await zip.generateAsync({ type: "nodebuffer" });
const body = new Uint8Array(buf);

return new NextResponse(body, {
  status: 200,
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": 'attachment; filename="export-me.zip"',
    "Cache-Control": "no-store",
  },
});
  } catch (e: any) {
    const msg = e?.message || "ERROR";
    if (msg === "NOT_AUTH") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}