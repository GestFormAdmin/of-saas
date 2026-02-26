export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function supabaseAuth() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return null;

  const sbAuth = supabaseAuth();
  const { data, error } = await sbAuth.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from("document_templates")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .single();

  if (error || !row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error: e2 } = await sb.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 120);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}