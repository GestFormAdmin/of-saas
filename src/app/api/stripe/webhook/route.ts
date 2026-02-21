import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ⚠️ PAS de Stripe init au top-level (sinon build casse)

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // on ne throw pas au build; on renverra une 500 au runtime si route appelée
    return null;
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type PlanCode = "free" | "pro" | "business" | "scale" | "enterprise" | "custom";

// ✅ mapping price_id -> plan_code (TES IDs) — ne throw jamais (build-safe)
function planFromPriceId(priceId: string | null): PlanCode {
  if (!priceId) return "free";

  const pro = process.env.STRIPE_PRICE_PRO;
  const business = process.env.STRIPE_PRICE_BUSINESS;
  const scale = process.env.STRIPE_PRICE_SCALE;
  const enterprise = process.env.STRIPE_PRICE_ENTERPRISE;

  if (pro && priceId === pro) return "pro";
  if (business && priceId === business) return "business";
  if (scale && priceId === scale) return "scale";
  if (enterprise && priceId === enterprise) return "enterprise";
  return "free";
}

export async function POST(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Missing env: STRIPE_SECRET_KEY" }, { status: 500 });
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing env: STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-07-30.basil" as any,
  });

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 });
  }

  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription as any;

      const orgId = (sub.metadata?.org_id ?? null) as string | null;
      if (!orgId) {
        return NextResponse.json({ received: true, ignored: "missing org_id metadata" });
      }

      const status = String(sub.status ?? "");
      const priceId = (sub.items?.data?.[0]?.price?.id ?? null) as string | null;
      const planCode = planFromPriceId(priceId);

      const currentPeriodEnd =
        sub.current_period_end != null
          ? new Date(Number(sub.current_period_end) * 1000).toISOString()
          : null;

      const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

      const { error: upErr } = await admin
        .from("org_billing_subscriptions")
        .upsert(
          {
            org_id: orgId,
            stripe_customer_id: String(sub.customer),
            stripe_subscription_id: String(sub.id),
            stripe_price_id: priceId,
            plan_code: planCode,
            status,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end: currentPeriodEnd,
          },
          { onConflict: "stripe_subscription_id" }
        );

      if (upErr) throw upErr;
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Webhook error" }, { status: 500 });
  }
}