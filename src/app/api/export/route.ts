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
  { name: "profiles", filter: { column: "id", by: "user_id" } },
  { name: "organizations", filter: { column: "id", by: "org_id" } },
  { name: "memberships", filter: { column: "org_id", by: "org_id" } },
  { name: "clients", filter: { column: "org_id", by: "org_id" } },
  { name: "products", filter: { column: "org_id", by: "org_id" } },
  { name: "sessions", filter: { column: "org_id", by: "org_id" } },
  { name: "apprenants", filter: { column: "org_id", by: "org_id" } },
  { name: "apprenants_full", filter: { column: "org_id", by: "org_id" } },
  { name: "expenses", filter: { column: "org_id", by: "org_id" } },
  { name: "factures", filter: { column: "org_id", by: "org_id" } },
  { name: "invoices", filter: { column: "org_id", by: "org_id" } },
  { name: "billing_documents", filter: { column: "org_id", by: "org_id" } },
  { name: "documents", filter: { column: "org_id", by: "org_id" } },
  { name: "apprenant_sessions", filter: { column: "org_id", by: "org_id" } },
  { name: "session_attendees", filter: { column: "org_id", by: "org_id" } },
  { name: "session_learners", filter: { column: "org_id", by: "org_id" } },
  { name: "session_trainers", filter: { column: "org_id", by: "org_id" } },
] as const;

/* ---------------- HELPERS ---------------- */

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeRows(rows: any[]) {
  if (!rows.length) return rows;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  return rows.map((r) => {
    const o: Record<string, any> = {};
    for (const k of keys) o[k] = r?.[k] ?? "";
    return o;
  });
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");
}

/* ---------------- AUTH ---------------- */

async function getUserAndCurrentOrgId(supabase: any) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("UNAUTHORIZED");

  const userId = data.user.id;

  const { data: prof } = await supabase
    .from("profiles")
    .select("current_org_id")
    .eq("id", userId)
    .maybeSingle();

  if (!prof?.current_org_id) throw new Error("NO_CURRENT_ORG");

  return { userId, orgId: prof.current_org_id as string };
}

/* ---------------- DATA FETCH ---------------- */

async function fetchTable(
  supabase: any,
  table: string,
  userId: string,
  orgId: string,
  filter?: { column: string; by: "org_id" | "user_id" }
) {
  if (table === "apprenants") {
    const { data, error } = await supabase.rpc("export_apprenants_json", { _org_id: orgId });
    if (error) return { __error: error.message };
    return data ?? [];
  }

  if (table === "apprenants_full") {
    const { data, error } = await supabase
      .from("apprenants")
      .select("*")
      .eq("org_id", orgId);
    if (error) return { __error: error.message };
    return data ?? [];
  }

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

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    }
  );
}

/* ---------------- ROUTE ---------------- */

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") || "csv";

  const supabase =
    createSupabaseFromBearer(req) ?? (await createSupabaseRouteClient());

  const { userId, orgId } = await getUserAndCurrentOrgId(supabase);

  const payload: Record<string, any[]> = {};
  const errors: any[] = [];

  for (const spec of EXPORT_SPEC) {
    const res = await fetchTable(supabase, spec.name, userId, orgId, spec.filter);
    if ((res as any)?.__error) {
      errors.push({ table: spec.name, error: (res as any).__error });
      payload[spec.name] = [];
    } else {
      payload[spec.name] = normalizeRows(res as any[]);
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
      rows.forEach((r) => ws.addRow(headers.map((h) => r[h])));
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  /* ---- CSV ZIP ---- */
  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(pass);

  for (const [table, rows] of Object.entries(payload)) {
    archive.append(toCsv(rows), { name: `${table}.csv` });
  }
  if (errors.length) archive.append(toCsv(errors), { name: `_errors.csv` });

  await archive.finalize();

  return new NextResponse(Readable.toWeb(pass) as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${baseName}_csv.zip"`,
    },
  });
}