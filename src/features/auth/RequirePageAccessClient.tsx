"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "./PermissionsProviderClient";

export default function RequirePageAccessClient({
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

    if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
      router.replace("/settings/acces");
      return;
    }

    if (!allowedPages.includes(pageKey)) {
      router.replace("/settings/acces");
    }
  }, [isLoading, allowedPages, pageKey, router]);

  if (isLoading) return fallback;
  if (!allowedPages?.includes(pageKey)) return fallback;

  return <>{children}</>;
}