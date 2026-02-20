"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "./PermissionsProviderClient";

export function RequirePageAccess({
  pageKey,
  children,
  fallback = null,
}: {
  pageKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const router = useRouter();
  const { allowedPages, isLoading } = usePermissions();

  React.useEffect(() => {
    if (isLoading) return;

    // Si aucune permission chargée, on renvoie vers /settings/acces (page centrale)
    if (!allowedPages?.length) {
      router.replace("/settings/acces");
      return;
    }

    // Si la page n'est pas autorisée, même redirection
    if (!allowedPages.includes(pageKey)) {
      router.replace("/settings/acces");
      return;
    }
  }, [isLoading, allowedPages, pageKey, router]);

  if (isLoading) return fallback;
  if (!allowedPages?.includes(pageKey)) return fallback;

  return <>{children}</>;
}
