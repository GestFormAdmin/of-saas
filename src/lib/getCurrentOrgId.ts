// src/lib/getCurrentOrgId.ts
// ⚠️ À UTILISER UNIQUEMENT côté serveur (Server Components / route handlers)

export async function getCurrentOrgId(): Promise<string | null> {
  // Import dynamique pour éviter les mauvaises analyses bundler
 const { createSupabaseServerClient } = await import("@/lib/supabase/server");
const sb = await createSupabaseServerClient();

  // Si ton RPC s'appelle autrement, change juste la string
  const { data, error } = await sb.rpc("get_current_org_id");
  if (error) return null;

  if (!data) return null;
  if (typeof data === "string") return data;

  // ex: { org_id: "..." }
  if (typeof data === "object" && data !== null && "org_id" in (data as any)) {
    return (data as any).org_id ?? null;
  }

  return null;
}

export default getCurrentOrgId;