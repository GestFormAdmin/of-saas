"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrgId } from "@/lib/getCurrentOrgId";

type Sub = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type Inv = {
  id: string;
  invoice_number: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  pdf_url: string | null;
};

export default function BillingCard({ loading }: { loading: boolean }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [invoices, setInvoices] = useState<Inv[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sb = supabase;
      if (!sb) {
        if (!cancelled) {
          setSub(null);
          setInvoices([]);
        }
        return;
      }

      const orgId = await getCurrentOrgId();
      if (!orgId) {
        if (!cancelled) {
          setSub(null);
          setInvoices([]);
        }
        return;
      }

      const { data: s } = await sb
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: inv } = await sb
        .from("invoices")
        .select("id,invoice_number,amount_cents,currency,status,created_at,pdf_url")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (cancelled) return;

      setSub((s as any) ?? null);
      setInvoices((inv as any) ?? []);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">Abonnement</div>
          <div className="mt-1 text-lg font-semibold">Abonnement & paiements</div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Plan</div>
              <div className="font-medium">{loading ? "..." : sub?.plan ?? "free"}</div>
            </div>
            <div>
              <div className="text-gray-500">Statut</div>
              <div className="font-medium">{loading ? "..." : sub?.status ?? "inactive"}</div>
            </div>
            <div>
              <div className="text-gray-500">Prochaine échéance</div>
              <div className="font-medium">{loading ? "..." : sub?.current_period_end ?? "-"}</div>
            </div>
          </div>
        </div>

        <Button variant="secondary" disabled>
          Gérer l’abonnement
        </Button>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold">Dernières factures</div>

        <div className="mt-3 space-y-2">
          {invoices.length === 0 ? (
            <div className="text-sm text-gray-500">Aucune facture.</div>
          ) : (
            invoices.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{i.invoice_number ?? "Facture"}</div>
                  <div className="text-gray-500">
                    {i.created_at} · {i.status}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-semibold">
                    {(i.amount_cents / 100).toFixed(2)} {i.currency}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => i.pdf_url && window.open(i.pdf_url, "_blank")}
                    disabled={!i.pdf_url}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}