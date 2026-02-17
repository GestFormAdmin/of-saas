import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BillingPlanCode =
  | "free"
  | "pro"
  | "business"
  | "scale"
  | "enterprise"
  | "custom";

function isBillingPlanCode(x: any): x is BillingPlanCode {
  return (
    x === "free" ||
    x === "pro" ||
    x === "business" ||
    x === "scale" ||
    x === "enterprise" ||
    x === "custom"
  );
}

function assertUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

function getPriceIdForPlan(plan: BillingPlanCode): string | null {
  const map: Record<BillingPlanCode, string | null> = {
    free: null,
    custom: null,
    pro: process.env.STRIPE_PRICE_PRO ?? null,
    business: process.env.STRIPE_PRICE_BUSINESS ?? null,
    scale: process.env.STRIPE_PRICE_SCALE ?? null,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
  };
  return map[plan];
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireSupabaseUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return { error: "Missing Authorization: Bearer <access_token>", status: 401 as const };
  }

  const supabase = supabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Unauthorized (invalid Supabase token)", status: 401 as const };
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) throw new Error("Missing env: STRIPE_SECRET_KEY");

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2025-07-30.basil" as any,
});

type Body = {
  plan?: BillingPlanCode;
  org_id?: string;
  return_path?: string;
};

export async function POST(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json()) as Body;
    const plan = body.plan;
    const orgId = body.org_id;

    if (!plan || !isBillingPlanCode(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (!orgId || typeof orgId !== "string" || !assertUuid(orgId)) {
      return NextResponse.json({ error: "Invalid org_id (uuid expected)" }, { status: 400 });
    }

    if (plan === "free") {
      return NextResponse.json({ error: "Le plan free ne nécessite pas de paiement." }, { status: 400 });
    }
    if (plan === "custom") {
      return NextResponse.json({ error: "Le plan custom est sur devis." }, { status: 400 });
    }

    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID manquant (STRIPE_PRICE_PRO/BUSINESS/SCALE/ENTERPRISE)." },
        { status: 500 }
      );
    }

    const admin = supabaseAdmin();

    // ✅ check accès user -> org (basé sur ton user_current_orgs)
    const { data: membership, error: memErr } = await admin
      .from("user_current_orgs")
      .select("org_id")
      .eq("user_id", auth.user.id)
      .eq("org_id", orgId)
      .limit(1);

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden: org access denied" }, { status: 403 });
    }

    // ✅ éviter de recréer une subscription si déjà active
    const { data: activeSub, error: activeErr } = await admin
      .from("org_billing_subscriptions")
      .select("stripe_subscription_id,status")
      .eq("org_id", orgId)
      .in("status", ["trialing", "active", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });
    if (activeSub && activeSub.length > 0) {
      return NextResponse.json(
        { error: "Un abonnement existe déjà. Utilisez le portail.", code: "ORG_ALREADY_SUBSCRIBED" },
        { status: 409 }
      );
    }

    // ✅ stripe_customer_id (org-level)
    const { data: orgCustomer, error: orgCustErr } = await admin
      .from("org_stripe_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (orgCustErr) return NextResponse.json({ error: orgCustErr.message }, { status: 500 });

    let stripeCustomerId = orgCustomer?.stripe_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email ?? undefined,
        metadata: { org_id: orgId, created_by_user_id: auth.user.id },
      });
      stripeCustomerId = customer.id;

      const { error: upErr } = await admin
        .from("org_stripe_customers")
        .upsert(
          { org_id: orgId, stripe_customer_id: stripeCustomerId, created_by_user_id: auth.user.id },
          { onConflict: "org_id" }
        );

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const baseUrl = getAppBaseUrl();
    const returnPath = body.return_path ?? "/settings/abonnement";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}${returnPath}?success=1`,
      cancel_url: `${baseUrl}${returnPath}?canceled=1`,
      client_reference_id: orgId,
      metadata: { org_id: orgId, user_id: auth.user.id, plan_code: plan },
      subscription_data: {
        metadata: { org_id: orgId, user_id: auth.user.id, plan_code: plan },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe session created but no URL returned" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
