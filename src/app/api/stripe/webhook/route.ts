import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) throw new Error("Missing env: STRIPE_SECRET_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil" as any,
});

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type PlanCode = "free" | "pro" | "business" | "scale" | "enterprise" | "custom";

// ✅ mapping price_id -> plan_code (TES IDs)
function planFromPriceId(priceId: string | null): PlanCode {
  if (!priceId) return "free";

  const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO;
  const STRIPE_PRICE_BUSINESS = process.env.STRIPE_PRICE_BUSINESS;
  const STRIPE_PRICE_SCALE = process.env.STRIPE_PRICE_SCALE;
  const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE;

  if (!STRIPE_PRICE_PRO) throw new Error("Missing env: STRIPE_PRICE_PRO");
  if (!STRIPE_PRICE_BUSINESS) throw new Error("Missing env: STRIPE_PRICE_BUSINESS");
  if (!STRIPE_PRICE_SCALE) throw new Error("Missing env: STRIPE_PRICE_SCALE");
  if (!STRIPE_PRICE_ENTERPRISE) throw new Error("Missing env: STRIPE_PRICE_ENTERPRISE");

  if (priceId === STRIPE_PRICE_PRO) return "pro";
  if (priceId === STRIPE_PRICE_BUSINESS) return "business";
  if (priceId === STRIPE_PRICE_SCALE) return "scale";
  if (priceId === STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return "free";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing env: STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      // TS compat selon version stripe: on garde un any pour les champs connus
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
