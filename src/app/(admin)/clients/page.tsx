"use client";

import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
import ClientsPageClient from "./ClientsPageClient";

export default function ClientsPage() {
  return (
    <RequirePageAccessClient pageKey="clients">
      <ClientsPageClient />
    </RequirePageAccessClient>
  );
}