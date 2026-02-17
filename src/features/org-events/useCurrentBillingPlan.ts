// ACTION 8 — Badge "Plan actuel"
// src/features/org-events/useCurrentBillingPlan.ts

'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/browser';

export type BillingPlan = {
  org_id: string;
  billing_year: number;
  apprenants_n_1: number;
  plan_code: 'free' | 'pro' | 'business' | 'scale' | 'enterprise' | 'custom';
  price_eur: number;
  calculated_at: string;
};

export function useCurrentBillingPlan() {
  const supabase = createBrowserClient();
  const [data, setData] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.rpc('get_my_current_org_billing_plan');
      if (!alive) return;

      if (!error && data && data[0]) {
        setData(data[0] as BillingPlan);
      } else {
        setData(null);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  return { data, loading };
}
