"use client";

import ProduitsView from "@/features/produits/components/ProduitsView";
import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
export default function ProduitsPage() {
  return (
<RequirePageAccessClient pageKey="produits" fallback={null}>
        <ProduitsView />
</RequirePageAccessClient>
  );
}
