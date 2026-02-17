import AdminShell from "@/components/AdminShell";
import { PermissionsProviderClient } from "@/features/auth/PermissionsProviderClient";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionsProviderClient>
      <AdminShell>{children}</AdminShell>
    </PermissionsProviderClient>
  );
}
