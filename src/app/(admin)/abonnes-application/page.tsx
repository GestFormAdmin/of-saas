// src/app/(admin)/abonnes-application/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import SubscribersApplicationTableClient, {
  type SubscriberRow,
} from "./SubscribersApplicationTableClient";

type BillingKpiRow = {
  org_id: string;
  org_name: string;
  apprenants_n_1: number;
  plan_code:
    | "free"
    | "pro"
    | "business"
    | "scale"
    | "enterprise"
    | "custom"
    | string;
  price_eur: number | null;
  billing_year: number;
};

export default async function Page() {
  // ✅ IMPORTANT: on évite d'importer "@/lib/supabase/server" au top-level
  // car ce module throw si NEXT_PUBLIC_SUPABASE_URL manque pendant le build.
  let createSupabaseServerClient: any;

  try {
    const mod = await import("@/lib/supabase/server");
    createSupabaseServerClient = mod.createSupabaseServerClient;
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Abonnés application"
          description="TalentUpFP — utilisateurs, abonnements & paiements"
        />
        <Card>
          <div className="p-4 text-sm text-muted-foreground">
            Configuration Supabase manquante côté serveur (NEXT_PUBLIC_SUPABASE_URL).
            Ajoute les variables d’environnement sur Vercel puis redeploy.
          </div>
        </Card>
      </div>
    );
  }

  let supabase: any;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Abonnés application"
          description="TalentUpFP — utilisateurs, abonnements & paiements"
        />
        <Card>
          <div className="p-4 text-sm text-muted-foreground">
            Supabase server client indisponible (env manquantes côté build/runtime).
          </div>
        </Card>
      </div>
    );
  }

  const [
    { data: subsData, error: subsError },
    { data: kpiData, error: kpiError },
  ] = await Promise.all([
    supabase.rpc("get_app_subscribers_admin_v2").catch((e: any) => ({
      data: [],
      error: { message: e?.message ?? "RPC get_app_subscribers_admin_v2 failed" },
    })),
    supabase.rpc("admin_get_billing_kpis_v2").catch((e: any) => ({
      data: [],
      error: { message: e?.message ?? "RPC admin_get_billing_kpis_v2 failed" },
    })),
  ]);

  const rows: SubscriberRow[] = Array.isArray(subsData)
    ? (subsData as SubscriberRow[])
    : [];

  // (kpis pas utilisés dans l'UI actuelle, mais on garde la collecte)
  const _kpis: BillingKpiRow[] = Array.isArray(kpiData)
    ? (kpiData as BillingKpiRow[])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnés application"
        description="TalentUpFP — utilisateurs, abonnements & paiements"
      />

      <Card>
        <div className="p-4 space-y-4">
          {(subsError || kpiError) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {subsError?.message ?? kpiError?.message ?? "Erreur inconnue"}
            </div>
          )}

          {!subsError && <SubscribersApplicationTableClient rows={rows} />}
        </div>
      </Card>
    </div>
  );
}