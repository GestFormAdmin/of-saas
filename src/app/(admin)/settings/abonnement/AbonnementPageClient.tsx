"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import LegalPricingText from "./LegalPricingText";

type BillingPlanCode =
  | "free"
  | "pro"
  | "business"
  | "scale"
  | "enterprise"
  | "custom";

type BillingPlan = {
  org_id: string;
  plan_code: BillingPlanCode;
  billing_year: number;
  stripe_subscription_id: string | null;
};

type UiPlan = {
  key: BillingPlanCode;
  name: string;
  icon: string;
  price: string;
  period: string;
  range: string;
  features: string[];
};

const PLAN_ORDER: BillingPlanCode[] = [
  "free",
  "pro",
  "business",
  "scale",
  "enterprise",
  "custom",
];

const idx = (p: BillingPlanCode) => {
  const i = PLAN_ORDER.indexOf(p);
  return i === -1 ? 999 : i;
};

function normalizePlanCode(code: any): BillingPlanCode {
  if (!code) return "free";
  const c = String(code).toLowerCase();
  if (c === "starter") return "free";
  if (c === "free") return "free";
  if (c === "pro") return "pro";
  if (c === "business") return "business";
  if (c === "scale") return "scale";
  if (c === "enterprise") return "enterprise";
  if (c === "custom") return "custom";
  if (c === "scale+") return "enterprise";
  return "free";
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<BillingPlanCode | null>(null);

  const plans = useMemo<UiPlan[]>(
    () => [
      {
        key: "free",
        name: "Starter",
        icon: "🌱",
        price: "0 €",
        period: "/ mois",
        range: "0 – 200 apprenants / an (N-1)",
        features: [
          "Multi-org",
          "RBAC + RLS",
          "Sessions / Apprenants / Clients",
          "Facturation",
          "Export RGPD (Excel + PDF)",
        ],
      },
      {
        key: "pro",
        name: "Pro",
        icon: "🚀",
        price: "29 €",
        period: "/ mois",
        range: "201 – 500 apprenants / an (N-1)",
        features: [
          "Tout Starter",
          "Support prioritaire (email)",
          "Organisation plus active",
        ],
      },
      {
        key: "business",
        name: "Business",
        icon: "🏢",
        price: "59 €",
        period: "/ mois",
        range: "501 – 1 000 apprenants / an (N-1)",
        features: ["Tout Pro", "Usage intensif", "Meilleure priorité support"],
      },
      {
        key: "scale",
        name: "Scale",
        icon: "📈",
        price: "89 €",
        period: "/ mois",
        range: "1 001 – 1 500 apprenants / an (N-1)",
        features: ["Tout Business", "Pour OF en croissance"],
      },
      {
        key: "enterprise",
        name: "Scale+",
        icon: "🔥",
        price: "109 €",
        period: "/ mois",
        range: "1 501 – 2 000 apprenants / an (N-1)",
        features: ["Tout Scale", "Pour OF très actif"],
      },
      {
        key: "custom",
        name: "Entreprise",
        icon: "⭐",
        price: "Sur devis",
        period: "",
        range: "2 001+ apprenants / an (N-1)",
        features: ["Accompagnement", "Conditions spécifiques", "Priorité maximale"],
      },
    ],
    []
  );

  const loadBilling = async () => {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setBilling(null);
      setOrgId(null);
      setLoading(false);
      return;
    }

    const { data: curOrg, error: curOrgErr } = await supabase
      .from("user_current_orgs")
      .select("org_id, updated_at")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    const oid =
      !curOrgErr && curOrg && curOrg[0]?.org_id
        ? String(curOrg[0].org_id)
        : null;

    setOrgId(oid);

    if (!oid) {
      setBilling(null);
      setLoading(false);
      return;
    }

    const { data: planByOrg, error: planByOrgErr } = await supabase.rpc(
      "get_org_active_plan",
      { p_org_id: oid }
    );

    if (!planByOrgErr && planByOrg && planByOrg[0]?.plan_code) {
      setBilling({
        org_id: oid,
        plan_code: normalizePlanCode(planByOrg[0].plan_code),
        billing_year: new Date().getFullYear(),
        stripe_subscription_id: planByOrg[0].stripe_subscription_id ?? null,
      });
    } else {
      setBilling({
        org_id: oid,
        plan_code: "free",
        billing_year: new Date().getFullYear(),
        stripe_subscription_id: null,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const success = url.searchParams.get("success");

      await loadBilling();

      // retour Stripe: refresh + reload
      if (success === "1") {
        setTimeout(async () => {
          await loadBilling();
          window.history.replaceState({}, "", "/settings/abonnement");
          window.location.reload();
        }, 1200);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlanKey: BillingPlanCode = billing?.plan_code ?? "free";
  const currentIndex = idx(currentPlanKey);

  async function getBearerToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }

  const subscribe = async (plan: BillingPlanCode) => {
    if (!orgId) return alert("orgId manquant");

    const token = await getBearerToken();
    if (!token) return alert("Session manquante (reconnecte-toi).");

    try {
      setLoadingPlan(plan);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          org_id: orgId,
          return_path: "/settings/abonnement",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) return alert(data?.error || `API error ${res.status}`);
      if (!data?.url) return alert(data?.error || "no stripe url");

      window.location.href = data.url;
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnement</h1>
          <p className="text-sm text-gray-500">
            Plan basé sur le flux d’apprenants de l’année précédente (N-1).
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Org: <span className="font-mono">{orgId ?? "—"}</span> • Plan:{" "}
            <span className="font-mono">{currentPlanKey}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={loading}
            onClick={loadBilling}
          >
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Plans & tarifs</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          {plans.map((p) => {
            const pIndex = idx(p.key);
            const isCurrent = pIndex === currentIndex;
            const isLower = pIndex < currentIndex;
            const isHigher = pIndex > currentIndex;
            const isPlanLoading = loadingPlan === p.key;

            return (
              <div
                key={p.key}
                className="rounded-2xl border bg-white p-5 flex flex-col"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">Plan</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {p.icon} {p.name}
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        Plan actuel
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <div className="text-2xl font-semibold text-slate-900">
                      {p.price}{" "}
                      <span className="text-sm font-medium text-slate-500">
                        {p.period}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">{p.range}</div>
                  </div>

                  <ul className="space-y-2 text-sm text-slate-700">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-0.5">✅</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <button
                      className="btn btn-secondary w-full"
                      type="button"
                      disabled
                      aria-disabled="true"
                    >
                      Plan actuel
                    </button>
                  ) : isLower ? (
                    <button
                      className="btn btn-secondary w-full opacity-60 pointer-events-none"
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="Impossible de souscrire à un plan inférieur"
                    >
                      Souscrire
                    </button>
                  ) : p.key === "custom" ? (
                    <a
                      className="btn btn-primary w-full inline-flex items-center justify-center"
                      href="mailto:contact@tondomaine.com?subject=Offre%20Entreprise"
                    >
                      Nous contacter
                    </a>
                  ) : isHigher ? (
                    <button
                      className="btn btn-primary w-full"
                      type="button"
                      disabled={loading || isPlanLoading}
                      onClick={() => subscribe(p.key)}
                    >
                      {isPlanLoading ? "Redirection…" : "Souscrire"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-slate-500">
          Les seuils sont calculés sur le nombre d’apprenants de l’année précédente (N-1).
        </div>
      </div>

      <LegalPricingText />
    </div>
  );
}
