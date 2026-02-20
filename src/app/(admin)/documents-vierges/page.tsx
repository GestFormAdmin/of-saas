import React from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RequirePageAccessProps = {
  permission: string;
  children: React.ReactNode;
};

async function RequirePageAccess({
  permission,
  children,
}: RequirePageAccessProps) {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_my_page_permissions");

  if (error) {
    redirect("/dashboard");
  }

  const allowed = new Set(
    (data ?? []).map((r: any) =>
      typeof r === "string" ? r : r.permission_key
    )
  );

  if (!allowed.has(permission)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

export default async function DocumentsViergesPage() {
  return (
    <RequirePageAccess permission="documents_vierges">
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          Documents vierges
        </h1>
      </div>
    </RequirePageAccess>
  );
}
