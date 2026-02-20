import { supabase } from "@/lib/supabaseClient";

export async function getCurrentOrgId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_my_account_context_v2");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.current_org_id ?? null;
}

export default getCurrentOrgId;
