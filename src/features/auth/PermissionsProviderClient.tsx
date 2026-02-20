"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/browser";

type Ctx = {
  allowedPages: string[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = React.createContext<Ctx | null>(null);

// fallback
const MIN_ALLOWED = ["dashboard", "sessions", "apprenants"];

export function PermissionsProviderClient({ children }: { children: React.ReactNode }) {
  const [allowedPages, setAllowedPages] = React.useState<string[]>(MIN_ALLOWED);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_my_page_permissions");
    console.log("PERMISSIONS RPC RESULT", data, error);

    // ✅ DEBUG org/role
    const dbg = await supabase.rpc("debug_current_membership");
    console.log("DEBUG CURRENT MEMBERSHIP", dbg.data, dbg.error);

    if (!error && Array.isArray(data) && data.length > 0) {
      const pages = data
        .map((row: any) => {
          if (typeof row === "string") return row;
          return (
            row?.permission_key ??
            row?.key ??
            row?.page ??
            row?.page_key ??
            row?.permission ??
            null
          );
        })
        .filter(Boolean);

      if (pages.length) {
        setAllowedPages(Array.from(new Set(pages)));
        setIsLoading(false);
        return;
      }
    }

    setAllowedPages(MIN_ALLOWED);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const onOrgChanged = () => void refresh();
    window.addEventListener("fa:org_changed", onOrgChanged);
    return () => window.removeEventListener("fa:org_changed", onOrgChanged);
  }, [refresh]);

  return (
    <PermissionsContext.Provider value={{ allowedPages, isLoading, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = React.useContext(PermissionsContext);
  return ctx ?? { allowedPages: MIN_ALLOWED, isLoading: false, refresh: async () => {} };
}
