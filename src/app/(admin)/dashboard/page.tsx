"use client";

import Link from "next/link";
import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
import DashboardChartsClient from "./DashboardChartsClient";

export default function Page() {
  return (
    <RequirePageAccessClient pageKey="dashboard" fallback={null}>
      <div style={{ display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Accueil</h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <Link
            href="/settings/organisme"
            style={{
              display: "block",
              padding: 18,
              borderRadius: 16,
              textDecoration: "none",
              color: "white",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              minHeight: 110,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>Gérer</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              Mon compte
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
              Profil, organisme, infos
            </div>
          </Link>

          <Link
            href="/settings/acces"
            style={{
              display: "block",
              padding: 18,
              borderRadius: 16,
              textDecoration: "none",
              color: "white",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              minHeight: 110,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>Gérer</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              Mes accès
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
              Organisations, rôles, switch
            </div>
          </Link>

          <Link
            href="/settings/abonnement"
            style={{
              display: "block",
              padding: 18,
              borderRadius: 16,
              textDecoration: "none",
              color: "white",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              minHeight: 110,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>Gérer</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              Abonnement
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>
              Plan, facturation (plus tard)
            </div>
          </Link>
        </div>

        {/* Graphiques */}
        <DashboardChartsClient />
      </div>
    </RequirePageAccessClient>
  );
}