"use client";

import DepensesView from "@/features/depenses/components/DepensesView";
import { RequirePageAccess } from "@/features/auth/RequirePageAccess";

export default function DepensesPage() {
  return (
    <RequirePageAccess pageKey="depenses" fallback={null}>
      <DepensesView />
    </RequirePageAccess>
  );
}
