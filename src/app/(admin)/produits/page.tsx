"use client";

import ProduitsView from "@/features/produits/components/ProduitsView";
import { RequirePageAccess } from "@/features/auth/RequirePageAccess";

export default function ProduitsPage() {
  return (
    <RequirePageAccess pageKey="produits" fallback={null}>
      <ProduitsView />
    </RequirePageAccess>
  );
}
