"use client";

import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";

export default function DocumentsViergesPage() {
  return (
    <RequirePageAccessClient pageKey="documents_vierges" fallback={null}>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          Documents vierges
        </h1>
      </div>
    </RequirePageAccessClient>
  );
}