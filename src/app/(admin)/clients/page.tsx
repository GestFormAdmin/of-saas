"use client";

import { RequirePageAccess } from "@/features/auth/RequirePageAccess";
import ClientsPageClient from "./ClientsPageClient";

export default function ClientsPage() {
  return (
    <RequirePageAccess pageKey="clients" fallback={null}>
      <ClientsPageClient />
    </RequirePageAccess>
  );
}
