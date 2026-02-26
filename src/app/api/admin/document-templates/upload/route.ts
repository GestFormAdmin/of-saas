export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ Client admin (service role) pour écrire Storage + DB
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // ✅ serveur uniquement
    { auth: { persistSession: false } }
  );
}

// ✅ Client anon pour vérifier le JWT reçu
function supabaseAuth() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function safeName(name: string) {
  return (name || "document.docx")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    // ✅ 1) Vérif auth via Bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const sbAuth = supabaseAuth();
    const { data: userData, error: userErr } = await sbAuth.auth.getUser(token);
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // ✅ 2) Lire formData
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const doc_type = (form.get("doc_type") as string | null)?.trim() ?? "";

    if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });
    if (!doc_type) return NextResponse.json({ error: "missing_doc_type" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "only_docx_allowed" }, { status: 400 });
    }

    // ✅ 3) Upload storage (bucket privé)
    const sb = supabaseAdmin();

    const filename = safeName(file.name);
    const path = `documents/${doc_type}/${Date.now()}_${filename}`;

    const up = await sb.storage.from("templates").upload(path, file, {
      contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

    // ✅ 4) Upsert DB (colonne NOT NULL chez toi)
    const { error: dbErr } = await sb
      .from("document_templates")
      .upsert(
        {
          doc_type,
          name: filename,     // NOT NULL
          file_path: path,    // NOT NULL
          storage_bucket: "templates",
          storage_path: path,
          is_active: true,
          org_id: null,       // OK si colonne existe et nullable
          created_by: user.id // NOT NULL
        },
        { onConflict: "doc_type" }
      );

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", details: String(e?.message ?? e) }, { status: 500 });
  }
}