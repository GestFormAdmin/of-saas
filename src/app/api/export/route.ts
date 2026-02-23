// src/app/api/export/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { PassThrough, Readable } from "node:stream";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

/* ---------------- EXPORT CONFIG ---------------- */

const EXPORT_SPEC = [
  // user
  { name: "profiles", filter: { column: "id", by: "user_id" } },

  // org (table réelle dans ta DB)
  { name: "organizations", filter: { column: "id", by: "org_id" } },
  { name: "memberships", filter: { column: "org_id", by: "org_id" } },

  // core
  { name: "clients", filter: { column: "org_id", by: "org_id" } },
  { name: "products", filter: { column: "org_id", by: "org_id" } },
  { name: "sessions", filter: { column: "org_id", by: "org_id" } },
  { name: "apprenants", filter: { column: "org_id", by: "org_id" } },

  // dépenses / facturation / documents
  { name: "expenses", filter: { column: "org_id", by: "org_id" } },
  { name: "factures", filter: { column: "org_id", by: "org_id" } },
  { name: "invoices", filter: { column: "org_id", by: "org_id" } },
  { name: "billing_documents", filter: { column: "org_id", by: "org_id" } },
  { name: "documents", filter: { column: "org_id", by: "org_id" } },

  // liaisons utiles
  { name: "apprenant_sessions", filter: { column: "org_id", by: "org_id" } },
  { name: "session_attendees", filter: { column: "org_id", by: "org_id" } },
  { name: "session_learners", filter: { column: "org_id", by: "org_id" } },
  { name: "session_trainers", filter: { column: "org_id", by: "org_id" } },
] as const;

/* ---------------- HELPERS ---------------- */

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
}

/* ---------------- AUTH / CONTEXT ---------------- */

async function getUserAndCurrentOrgId(supabase: any) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("UNAUTHORIZED");

  const { data: ctx, error: ctxErr } = await supabase.rpc("get_my_account_context_v2");
  if (ctxErr) throw new Error(ctxErr.message);

  const row = Array.isArray(ctx) ? ctx[0] : ctx;
  if (!row?.current_org_id) throw new Error("NO_CURRENT_ORG");

  return { userId: data.user.id, orgId: row.current_org_id as string };
}

/* ---------------- DATA FETCH ---------------- */

async function fetchTable(
  supabase: any,
  table: string,
  userId: string,
  orgId: string,
  filter?: { column: string; by: "org_id" | "user_id" }
) {
  let q = supabase.from(table).select("*");

  if (filter?.by === "user_id") q = q.eq(filter.column, userId);
  if (filter?.by === "org_id") q = q.eq(filter.column, orgId);

  const { data, error } = await q;
  if (error) return { __error: error.message };
  return data ?? [];
}

function createSupabaseFromBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") || "csv";

  try {
const supabase =
  createSupabaseFromBearer(req) ?? (await createSupabaseRouteClient());    const { userId, orgId } = await getUserAndCurrentOrgId(supabase);

    const payload: Record<string, any> = {};
    const errors: Array<{ table: string; error: string }> = [];

    for (const spec of EXPORT_SPEC) {
      const res = await fetchTable(supabase, spec.name, userId, orgId, spec.filter);
      if ((res as any)?.__error) {
        errors.push({ table: spec.name, error: (res as any).__error });
        payload[spec.name] = [];
      } else {
        payload[spec.name] = res;
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `export_${stamp}`;

    /* ---- XLSX ---- */
    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();

      for (const [table, rows] of Object.entries(payload)) {
        const ws = wb.addWorksheet(table.slice(0, 31));
        if (!rows.length) {
          ws.addRow(["(vide)"]);
          continue;
        }

        const headers = Object.keys(rows[0]);
        ws.addRow(headers).font = { bold: true };
        (rows as any[]).forEach((r: any) => ws.addRow(headers.map((h) => r[h] ?? "")));
      }

      if (errors.length) {
        const ws = wb.addWorksheet("_errors");
        ws.addRow(["table", "error"]).font = { bold: true };
        errors.forEach((e) => ws.addRow([e.table, e.error]));
      }

      const buffer = await wb.xlsx.writeBuffer();
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    /* ---- CSV ZIP ---- */
    const pass = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(pass);

    for (const [table, rows] of Object.entries(payload)) {
      archive.append(toCsv(rows as any), { name: `${table}.csv` });
    }
    if (errors.length) archive.append(toCsv(errors as any), { name: `_errors.csv` });

    await archive.finalize();

    return new NextResponse(Readable.toWeb(pass) as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${baseName}_csv.zip"`,
      },
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (e.message === "NO_CURRENT_ORG") {
      return NextResponse.json({ ok: false, error: "No current org selected" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}