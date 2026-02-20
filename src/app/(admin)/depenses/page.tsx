"use client";

import DepensesView from "@/features/depenses/components/DepensesView";
import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
export default function DepensesPage() {
  return (
<RequirePageAccessClient pageKey="depenses" fallback={null}>      <DepensesView />
</RequirePageAccessClient>
  );
}
