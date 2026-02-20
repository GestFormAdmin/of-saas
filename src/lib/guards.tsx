import React from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Guard serveur – le backend décide, le front affiche
 */
export async function RequirePageAccess(props: {
  permission: string;
  children: React.ReactNode;
}) {
const sb = createServerClient();

  const { data, error } = await sb.rpc("get_my_page_permissions");
  if (error) {
    redirect("/dashboard");
  }

  const allowed = new Set(
    (data ?? []).map((r: any) =>
      typeof r === "string" ? r : r.permission_key
    )
  );

  if (!allowed.has(props.permission)) {
    redirect("/dashboard");
  }

  return <>{props.children}</>;
}
