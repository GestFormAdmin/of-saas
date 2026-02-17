import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
    const admin = supabaseAdmin();
    const baseUrl = getAppBaseUrl();
    const returnPath = body.return_path ?? "/settings/abonnement";

    let orgId = body.org_id ?? null;
    if (orgId !== null) {
      if (typeof orgId !== "string" || !assertUuid(orgId)) {
        return NextResponse.json({ error: "Invalid org_id (uuid expected)" }, { status: 400 });
      }
    } else {
      // fallback org courante
      const { data: curOrg, error: curOrgErr } = await admin
        .from("user_current_orgs")
        .select("org_id, updated_at")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (curOrgErr) return NextResponse.json({ error: curOrgErr.message }, { status: 500 });

      orgId = curOrg?.[0]?.org_id ? String(curOrg[0].org_id) : null;
      if (!orgId) return NextResponse.json({ error: "No org selected for this user" }, { status: 400 });
    }

    // check accès user -> org
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

    // stripe customer id
    const { data: orgCustomer, error: orgCustErr } = await admin
      .from("org_stripe_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (orgCustErr) return NextResponse.json({ error: orgCustErr.message }, { status: 500 });

    const stripeCustomerId = orgCustomer?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "Aucun Stripe customer pour cette org." }, { status: 400 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}${returnPath}`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
