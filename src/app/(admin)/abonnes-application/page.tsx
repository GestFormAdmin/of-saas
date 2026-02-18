// src/app/(admin)/abonnes-application/page.tsx
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import SubscribersApplicationTableClient, { type SubscriberRow } from './SubscribersApplicationTableClient';

type BillingKpiRow = {
  org_id: string;
  org_name: string;
  apprenants_n_1: number;
  plan_code: 'free' | 'pro' | 'business' | 'scale' | 'enterprise' | 'custom' | string;
  price_eur: number | null;
  billing_year: number;
};

function planLabel(code: string) {
  const c = String(code ?? 'free').toLowerCase();
  if (c === 'free' || c === 'starter') return 'Starter';
  if (c === 'pro') return 'Pro';
  if (c === 'business') return 'Business';
  if (c === 'scale') return 'Scale';
  if (c === 'enterprise' || c === 'scale+') return 'Scale+';
  if (c === 'custom') return 'Sur devis';
  return c;
}

export default async function Page() {
  const supabase = await createSupabaseServerClient();

  const [{ data: subsData, error: subsError }, { data: kpiData, error: kpiError }] = await Promise.all([
    supabase.rpc('get_app_subscribers_admin_v2'),
    supabase.rpc('admin_get_billing_kpis_v2'),
  ]);

  const rows: SubscriberRow[] = Array.isArray(subsData) ? (subsData as SubscriberRow[]) : [];
  const kpis: BillingKpiRow[] = Array.isArray(kpiData) ? (kpiData as BillingKpiRow[]) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Abonnés application" subtitle="TalentUpFP — utilisateurs, abonnements & paiements" />

      <Card>
  <div className="p-4 space-y-4">

        <div className="text-sm font-medium text-slate-900">KPI facturation</div>

        {kpiError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {kpiError.message}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="[&>th]:px-4 [&>th]:py-3 text-left [&>th]:font-medium [&>th]:text-slate-700">
                  <th>Organisation</th>
                  <th>Année</th>
                  <th>Apprenants N-1</th>
                  <th>Plan (réel)</th>
                  <th>Prix € / mois</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {kpis.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-slate-500">
                      Aucune donnée.
                    </td>
                  </tr>
                ) : (
                  kpis.map((r) => (
                    <tr key={`${r.org_id}-${r.billing_year}`} className="[&>td]:px-4 [&>td]:py-3">
                      <td className="font-medium text-slate-900">{r.org_name}</td>
                      <td className="text-slate-700">{r.billing_year}</td>
                      <td className="text-slate-900">{r.apprenants_n_1}</td>
                      <td className="text-slate-900">{planLabel(r.plan_code)}</td>
                      <td className="text-slate-900">
                        {String(r.plan_code).toLowerCase() === 'custom'
                          ? 'Sur devis'
                          : String(r.plan_code).toLowerCase() === 'free'
                            ? '0 €'
                            : r.price_eur == null
                              ? '—'
                              : `${r.price_eur} €`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        {subsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {subsError.message}
          </div>
        ) : (
          <SubscribersApplicationTableClient rows={rows} />
        )}
      </Card>
    </div>
  );
}
