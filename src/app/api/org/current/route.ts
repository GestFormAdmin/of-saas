import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
const sb = await createSupabaseServerClient();

  // ✅ adapte si ton RPC est différent
  const { data, error } = await sb.rpc("get_current_org_id");

  if (error) return NextResponse.json({ orgId: null }, { status: 200 });

  let orgId: string | null = null;
  if (typeof data === "string") orgId = data;
  else if (data && typeof data === "object" && "org_id" in (data as any)) orgId = (data as any).org_id ?? null;

  return NextResponse.json({ orgId }, { status: 200 });
}