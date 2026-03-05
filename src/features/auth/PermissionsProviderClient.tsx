// src/features/auth/PermissionsProviderClient.tsx
"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/browser";

type Ctx = {
  allowedPages: string[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = React.createContext<Ctx | null>(null);

// fallback minimal si RPC échoue
const MIN_ALLOWED = ["dashboard", "sessions", "apprenants"];

export function PermissionsProviderClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [allowedPages, setAllowedPages] = React.useState<string[]>(MIN_ALLOWED);
  const [isLoading, setIsLoading] = React.useState(true);

  // évite les refresh concurrents
  const refreshingRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("get_my_page_permissions");
      console.log("PERMISSIONS RPC RESULT", data, error);

      // debug membership active
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

        if (pages.length > 0) {
          setAllowedPages(Array.from(new Set(pages)));
          setIsLoading(false);
          refreshingRef.current = false;
          return;
        }
      }

      // fallback si rien reçu
      setAllowedPages(MIN_ALLOWED);
      setIsLoading(false);
    } catch (e: any) {
      console.error("Permissions refresh failed:", e);
      setAllowedPages(MIN_ALLOWED);
      setIsLoading(false);
    }

    refreshingRef.current = false;
  }, []);

  // refresh initial au mount
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // écoute changement d'organisation
  React.useEffect(() => {
    const onOrgChanged = () => {
      console.log("ORG CHANGED → refreshing permissions");
      void refresh();
    };

    window.addEventListener("fa:org_changed", onOrgChanged);

    return () => {
      window.removeEventListener("fa:org_changed", onOrgChanged);
    };
  }, [refresh]);

  return (
    <PermissionsContext.Provider value={{ allowedPages, isLoading, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = React.useContext(PermissionsContext);

  if (!ctx) {
    return {
      allowedPages: MIN_ALLOWED,
      isLoading: false,
      refresh: async () => {},
    };
  }

  return ctx;
}

export default PermissionsProviderClient;