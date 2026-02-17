import { supabase } from "@/lib/supabaseClient";

export async function getCurrentOrgId(): Promise<string | null> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (authErr || !userId) return null;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();

  if (orgErr || !org?.id) return null;

  return org.id as string;
}
