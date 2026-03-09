"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

export type BillingPlan = {
  org_id: string;
  plan_key: string | null;
  status: string | null;
  interval: string | null;
  current_period_end: string | null;
};

export function useCurrentBillingPlan() {
  const [data, setData] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);

      const { data, error } = await supabase
        .from("org_billing")
        .select("org_id,plan_key,status,interval,current_period_end")
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setData(null);
        setLoading(false);
        return;
      }

      setData((data as BillingPlan | null) ?? null);
      setLoading(false);
    }

    void run();

    return () => {
      alive = false;
    };
  }, []);

  return { data, loading };
}