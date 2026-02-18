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
  return ["free", "pro", "business", "scale", "enterprise", "custom"].includes(
    String(x)
  );
}

function assertUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function getBaseUrl() {
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

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon)
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
    );

  return createClient(url, anon, { auth: { persistSession: false } });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireSupabaseUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return { error: "Missing Authorization", status: 401 as const };
  }

  const supa = supabaseAnon();
  const { data, error } = await supa.auth.getUser(token);

  if (error || !data.user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) throw new Error("Missing env: STRIPE_SECRET_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
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
    const returnPath = body.return_path ?? "/settings/abonnement";

    if (!plan || !isBillingPlanCode(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (!orgId || typeof orgId !== "string" || !assertUuid(orgId)) {
      return NextResponse.json({ error: "Invalid org_id" }, { status: 400 });
    }

    if (plan === "free") {
      return NextResponse.json(
        { error: "Le plan free ne nécessite pas de paiement." },
        { status: 400 }
      );
    }
    if (plan === "custom") {
      return NextResponse.json(
        { error: "Le plan custom est sur devis." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // accès org
    const { data: membership, error: memErr } = await admin
      .from("user_current_orgs")
      .select("org_id")
      .eq("user_id", auth.user.id)
      .eq("org_id", orgId)
      .limit(1);

    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const baseUrl = getBaseUrl();

    // ✅ si abo actif → portail “changer de plan”
    const { data: activeSub, error: activeErr } = await admin
      .from("org_billing_subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,status")
      .eq("org_id", orgId)
      .in("status", ["active", "trialing", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

    if (activeSub && activeSub.length > 0) {
      const customerId = activeSub[0].stripe_customer_id;
      const subscriptionId = activeSub[0].stripe_subscription_id;

      if (!customerId || !subscriptionId) {
        return NextResponse.json(
          { error: "Subscription active mais customer/subscription id manquant en DB" },
          { status: 500 }
        );
      }

      // ✅ FIX ICI : subscription doit être dans flow_data.subscription_update.subscription
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}${returnPath}`,
        flow_data: {
          type: "subscription_update",
          subscription_update: {
            subscription: subscriptionId,
          },
        },
      });

      return NextResponse.json({ url: portal.url, mode: "portal_update" });
    }

    // ✅ sinon checkout normal
    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID manquant (STRIPE_PRICE_PRO/BUSINESS/SCALE/ENTERPRISE)." },
        { status: 500 }
      );
    }

    const customer = await stripe.customers.create({
      email: auth.user.email ?? undefined,
      metadata: { org_id: orgId, created_by_user_id: auth.user.id },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}${returnPath}?success=1`,
      cancel_url: `${baseUrl}${returnPath}?canceled=1`,
      client_reference_id: orgId,
      subscription_data: {
        metadata: { org_id: orgId, user_id: auth.user.id, plan_code: plan },
      },
      metadata: { org_id: orgId, user_id: auth.user.id, plan_code: plan },
    });

    return NextResponse.json({ url: session.url, mode: "checkout" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
