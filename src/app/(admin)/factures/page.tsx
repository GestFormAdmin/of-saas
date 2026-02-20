"use client";

import FacturesView from "@/features/factures/components/FacturesView";
import { RequirePageAccess } from "@/features/auth/RequirePageAccess";

export default function FacturesPage() {
  return (
    <RequirePageAccess pageKey="factures" fallback={null}>
      <FacturesView />
    </RequirePageAccess>
  );
}
