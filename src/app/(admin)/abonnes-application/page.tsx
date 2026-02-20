// src/app/(admin)/abonnes-application/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

function planLabel(code: string) {
  const c = String(code ?? "free").toLowerCase();
  if (c === "free" || c === "starter") return "Starter";
  if (c === "pro") return "Pro";
  if (c === "business") return "Business";
  if (c === "scale") return "Scale";
  if (c === "enterprise" || c === "scale+") return "Scale+";
  if (c === "custom") return "Sur devis";
  return c;
}

export default async function Page() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: subsData, error: subsError },
    { data: kpiData, error: kpiError },
  ] = await Promise.all([
    supabase.rpc("get_app_subscribers_admin_v2"),
    supabase.rpc("admin_get_billing_kpis_v2"),
  ]);

  const rows: SubscriberRow[] = Array.isArray(subsData)
    ? (subsData as SubscriberRow[])
    : [];

  const kpis: BillingKpiRow[] = Array.isArray(kpiData)
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
          {subsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {subsError.message}
            </div>
          )}

          {!subsError && (
            <SubscribersApplicationTableClient rows={rows} />
          )}
        </div>
      </Card>
    </div>
  );
}
