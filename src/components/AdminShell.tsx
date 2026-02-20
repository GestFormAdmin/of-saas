"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { usePermissions } from "@/features/auth/PermissionsProviderClient";
import AccessNotificationsGate from "@/features/access/AccessNotificationsGate";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  GraduationCap,
  FileText,
  Package,
  UserPlus,
} from "lucide-react";

type SidebarContext = {
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_logo_url: string | null;
  org_name: string | null;
  org_logo_url: string | null;
  current_org_id: string | null;
};

function SidebarHeaderInline(props: {
  appName: string;
  orgName: string | null;
  orgLogoUrl: string | null;
  userFullName: string | null;
  userAvatarUrl: string | null;
  userEmail: string | null;
}) {
  const { appName, orgName, orgLogoUrl, userFullName, userAvatarUrl, userEmail } = props;

  return (
    <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontSize: 14, opacity: 0.85 }}>{appName}</div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgLogoUrl} alt="Org" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 12, opacity: 0.9 }}>{(orgName ?? "OF").slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {orgName ?? "Organisation"}
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.8,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {userFullName ?? userEmail ?? ""}
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            width: 34,
            height: 34,
            borderRadius: 12,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatarUrl} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 12, opacity: 0.9 }}>
              {(userFullName ?? userEmail ?? "U").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [ctx, setCtx] = React.useState<SidebarContext | null>(null);
  const { allowedPages, isLoading, refresh } = usePermissions();

  const nav = React.useMemo<NavItem[]>(
    () => [
      { key: "dashboard", label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
      { key: "clients", label: "Clients", href: "/clients", icon: Users },
      { key: "sessions", label: "Sessions", href: "/sessions", icon: Calendar },
      { key: "depenses", label: "Dépenses", href: "/depenses", icon: Wallet },
      { key: "apprenants", label: "Apprenants", href: "/apprenants", icon: GraduationCap },
      { key: "factures", label: "Factures & Devis", href: "/factures", icon: FileText },
      { key: "produits", label: "Produits & Services", href: "/produits", icon: Package },
      { key: "abonnes_application", label: "Abonnés application", href: "/abonnes-application", icon: UserPlus },
      { key: "documents_vierges", label: "Documents vierges", href: "/documents-vierges", icon: FileText },
    ],
    []
  );

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_my_account_context_v2");
      if (!alive) return;
      if (error) return;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;

      // ✅ persist current org côté backend
      if (row?.current_org_id) {
        await supabase.rpc("set_current_org", { p_org_id: row.current_org_id });
        await refresh(); // ✅ recharge permissions après set_current_org
      }

      setCtx({
        user_email: row.user_email ?? null,
        user_first_name: row.user_first_name ?? null,
        user_last_name: row.user_last_name ?? null,
        user_logo_url: row.user_logo_url ?? null,
        org_name: row.org_name ?? null,
        org_logo_url: row.org_logo_url ?? null,
        current_org_id: row.current_org_id ?? null,
      });
    };

    void load();

    const onOrgChanged = () => void load();
    window.addEventListener("fa:org_changed", onOrgChanged);

    return () => {
      alive = false;
      window.removeEventListener("fa:org_changed", onOrgChanged);
    };
  }, [refresh]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const userFullName = React.useMemo(() => {
    const v = [ctx?.user_first_name, ctx?.user_last_name].filter(Boolean).join(" ");
    return v || null;
  }, [ctx?.user_first_name, ctx?.user_last_name]);

  const filteredNav = React.useMemo(() => {
    if (isLoading) return nav;
    if (!allowedPages) return nav;

    const allowed = new Set(allowedPages);
    const has = (k: string) => allowed.has(k) || allowed.has(k.replaceAll("_", "/"));

    return nav.filter((item) => item.href === "/dashboard" || has(item.key));
  }, [allowedPages, isLoading, nav]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AccessNotificationsGate />

      <aside style={{ width: 280, background: "#0d1535", color: "white", padding: 0 }}>
        <SidebarHeaderInline
          appName="FormaAdmin"
          orgName={ctx?.org_name ?? null}
          orgLogoUrl={ctx?.org_logo_url ?? null}
          userFullName={userFullName}
          userAvatarUrl={ctx?.user_logo_url ?? null}
          userEmail={ctx?.user_email ?? null}
        />

        <nav style={{ display: "grid", gap: 8, padding: 16 }}>
          {filteredNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "white",
                  background: active ? "rgba(255,255,255,0.18)" : "transparent",
                }}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 16 }}>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
            }}
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
