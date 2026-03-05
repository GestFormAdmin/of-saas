// src/features/dashboard/components/OrgSwitcherCard.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type Org = {
  org_id: string;
  org_name: string;
  org_type: "business" | "personal";
  role: string;
};

export default function OrgSwitcherCard() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc("get_my_orgs");
      if (error) console.error("get_my_orgs error", error);
      if (!error && data) setOrgs(data as Org[]);
      setLoading(false);
    };
    void load();
  }, []);

  const switchOrg = async (orgId: string) => {
    const before = await supabase.rpc("current_org_id");
    console.log("current_org_id BEFORE", before.data, before.error);

    const { error } = await supabase.rpc("set_current_org", { p_org_id: orgId });
    if (error) {
      console.error("set_current_org error", error);
      alert(error.message);
      return;
    }

    await supabase.auth.getSession();

    const after = await supabase.rpc("current_org_id");
    console.log("current_org_id AFTER", after.data, after.error);

    if (after.error || String(after.data ?? "") !== String(orgId)) {
      alert(
        `Switch non pris en compte.\nAttendu=${orgId}\nReçu=${String(after.data ?? "null")}\nErr=${
          after.error?.message ?? "—"
        }`
      );
      return;
    }

    window.dispatchEvent(new Event("fa:org_changed"));
    window.location.href = "/dashboard";
  };

  if (loading) return null;

  return (
    <div className="card space-y-2">
      <div className="text-sm font-medium">Changer d’espace</div>

      {orgs.length === 0 ? (
        <div className="border p-3 text-sm text-gray-400">Aucun organisme</div>
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => (
            <button
              key={org.org_id}
              className="w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold hover:bg-gray-50"
              onClick={() => void switchOrg(org.org_id)}
              type="button"
            >
              {org.org_name} {org.role === "admin" ? "⭐" : ""}
              <div className="text-xs font-normal text-gray-500">
                {org.org_type} — {org.role}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}