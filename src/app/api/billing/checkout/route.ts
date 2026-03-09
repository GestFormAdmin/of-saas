import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanCode = "free" | "pro" | "business" | "scale" | "enterprise" | "custom";

type Body = {
  plan?: PlanCode;
  org_id?: string;
  return_path?: string;
};

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

function getPriceId(plan: PlanCode): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "business") return process.env.STRIPE_PRICE_BUSINESS ?? null;
  if (plan === "scale") return process.env.STRIPE_PRICE_SCALE ?? null;
  if (plan === "enterprise") return process.env.STRIPE_PRICE_ENTERPRISE ?? null;
  return null;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anon) return null;

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
  if (!supabase) {
    return {
      error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      status: 500 as const,
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Unauthorized (invalid Supabase token)", status: 401 as const };
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return NextResponse.json({ error: "Missing env: STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-07-30.basil" as any,
    });

    const auth = await requireSupabaseUser(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = supabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const plan = body.plan ?? "free";
    const baseUrl = getAppBaseUrl();
    const returnPath = body.return_path ?? "/settings/abonnement";

    if (plan === "free" || plan === "custom") {
      return NextResponse.json(
        { error: "Ce plan ne passe pas par Stripe checkout." },
        { status: 400 }
      );
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: `Aucun price Stripe configuré pour le plan ${plan}` },
        { status: 400 }
      );
    }

    let orgId = body.org_id ?? null;
    if (orgId !== null) {
      if (typeof orgId !== "string" || !assertUuid(orgId)) {
        return NextResponse.json({ error: "Invalid org_id (uuid expected)" }, { status: 400 });
      }
    } else {
      const { data: curOrg, error: curOrgErr } = await admin
        .from("user_current_orgs")
        .select("org_id, updated_at")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (curOrgErr) {
        return NextResponse.json({ error: curOrgErr.message }, { status: 500 });
      }

      orgId = curOrg?.[0]?.org_id ? String(curOrg[0].org_id) : null;
      if (!orgId) {
        return NextResponse.json({ error: "No org selected for this user" }, { status: 400 });
      }
    }

    const { data: membership, error: memErr } = await admin
      .from("user_current_orgs")
      .select("org_id")
      .eq("user_id", auth.user.id)
      .eq("org_id", orgId)
      .limit(1);

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden: org access denied" }, { status: 403 });
    }

    const { data: orgCustomer, error: orgCustErr } = await admin
      .from("org_stripe_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (orgCustErr) {
      return NextResponse.json({ error: orgCustErr.message }, { status: 500 });
    }

    const existingCustomerId = orgCustomer?.stripe_customer_id ?? null;
    const isOneShotTest = plan === "enterprise";

    const session = await stripe.checkout.sessions.create(
      isOneShotTest
        ? {
            mode: "payment",
            success_url: `${baseUrl}${returnPath}?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}${returnPath}?canceled=1`,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            customer: existingCustomerId || undefined,
            customer_email: existingCustomerId ? undefined : auth.user.email ?? undefined,
            metadata: {
              org_id: orgId,
              plan,
              user_id: auth.user.id,
            },
          }
        : {
            mode: "subscription",
            success_url: `${baseUrl}${returnPath}?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}${returnPath}?canceled=1`,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            customer: existingCustomerId || undefined,
            customer_email: existingCustomerId ? undefined : auth.user.email ?? undefined,
            metadata: {
              org_id: orgId,
              plan,
              user_id: auth.user.id,
            },
            subscription_data: {
              metadata: {
                org_id: orgId,
                plan,
                user_id: auth.user.id,
              },
            },
          }
    );

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}