export async function getCurrentOrgIdClient(): Promise<string | null> {
  const res = await fetch("/api/org/current", { cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
  return json?.orgId ?? null;
}