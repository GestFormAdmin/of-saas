export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { PassThrough, Readable } from "node:stream";
import { createServerClient } from "@supabase/ssr";

function createSupabaseServer(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: any[]) {
  if (!rows || rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r?.[h])).join(",")),
  ];
  return lines.join("\n");
}

// ⚠️ Export “org courante” (pas besoin de org_members)
const EXPORT_SPEC: Array<{
  name: string;
  filter?: { column: string; by: "org_id" | "user_id" | "none" };
}> = [
  { name: "profiles", filter: { column: "id", by: "user_id" } },
  { name: "orgs", filter: { column: "id", by: "org_id" } },

  // tables métier
  { name: "clients", filter: { column: "org_id", by: "org_id" } },
  { name: "products", filter: { column: "org_id", by: "org_id" } },
  { name: "sessions", filter: { column: "org_id", by: "org_id" } },
  { name: "apprenants", filter: { column: "org_id", by: "org_id" } },
];

async function getUserAndCurrentOrgId(supabase: any) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) throw new Error("UNAUTHORIZED");

  // ✅ utilise ton RPC existant pour récupérer org courante
  const { data, error } = await supabase.rpc("get_my_account_context_v2");
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  const currentOrgId = row?.current_org_id ?? null;

  if (!currentOrgId) throw new Error("NO_CURRENT_ORG");

  return { userId: user.id, orgId: currentOrgId as string };
}

async function fetchTable(
  supabase: any,
  table: string,
  userId: string,
  orgId: string,
  filter?: { column: string; by: "org_id" | "user_id" | "none" }
) {
  let q = supabase.from(table).select("*");

  if (filter?.by === "user_id") {
    q = q.eq(filter.column, userId);
  } else if (filter?.by === "org_id") {
    q = q.eq(filter.column, orgId);
  }

  const { data, error } = await q;
  if (error) return { __error: error.message };
  return data || [];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  try {
    const supabase = createSupabaseServer(req);
    const { userId, orgId } = await getUserAndCurrentOrgId(supabase);

    const payload: Record<string, any[] | { __error: string }> = {};
    for (const spec of EXPORT_SPEC) {
      payload[spec.name] = await fetchTable(supabase, spec.name, userId, orgId, spec.filter);
    }

    const errors: any[] = [];
    for (const [table, rows] of Object.entries(payload)) {
      if ((rows as any)?.__error) {
        errors.push({ table, error: (rows as any).__error });
        payload[table] = [];
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `export_${stamp}`;

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "FormaAdmin";
      wb.created = new Date();

      for (const [table, rows] of Object.entries(payload)) {
        const ws = wb.addWorksheet(table.slice(0, 31));
        const arr = Array.isArray(rows) ? rows : [];

        if (arr.length === 0) {
          ws.addRow(["(vide)"]);
          continue;
        }

        const headers = Array.from(
          arr.reduce((set, r) => {
            Object.keys(r || {}).forEach((k) => set.add(k));
            return set;
          }, new Set<string>())
        );

        ws.addRow(headers);
        for (const r of arr) ws.addRow(headers.map((h) => r?.[h] ?? ""));
        ws.getRow(1).font = { bold: true };
      }

      if (errors.length) {
        const ws = wb.addWorksheet("_errors");
        ws.addRow(["table", "error"]);
        errors.forEach((e) => ws.addRow([e.table, e.error]));
        ws.getRow(1).font = { bold: true };
      }

      const buffer = await wb.xlsx.writeBuffer();

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const pass = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(pass);

    for (const [table, rows] of Object.entries(payload)) {
      const csv = toCsv(Array.isArray(rows) ? rows : []);
      archive.append(csv || "", { name: `${table}.csv` });
    }
    if (errors.length) archive.append(toCsv(errors), { name: `_errors.csv` });

    void archive.finalize();

    return new NextResponse(Readable.toWeb(pass) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${baseName}_csv.zip"`,
      },
    });
  } catch (e: any) {
    const msg = e?.message || "Export error";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "NO_CURRENT_ORG") {
      return NextResponse.json({ ok: false, error: "No current org selected" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}