import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

async function requireSupabaseUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing Authorization: Bearer <access_token>",
    };
  }

  const supa = supabaseAnon();
  const { data, error } = await supa.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, user: { id: data.user.id } };
}

type PlanCode = "free" | "pro" | "business" | "scale" | "enterprise" | "custom";

function normalizePlan(code: any): PlanCode {
  const c = String(code ?? "free").toLowerCase();
  if (c === "starter") return "free";
  if (c === "scale+") return "enterprise";
  if (c === "free") return "free";
  if (c === "pro") return "pro";
  if (c === "business") return "business";
  if (c === "scale") return "scale";
  if (c === "enterprise") return "enterprise";
  if (c === "custom") return "custom";
  return "free";
}

export async function GET(req: Request) {
  try {
    const auth = await requireSupabaseUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = supabaseAdmin();

    // 1) org courante (la plus récente)
    const { data: curOrg, error: curOrgErr } = await admin
      .from("user_current_orgs")
      .select("org_id, updated_at")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (curOrgErr) {
      return NextResponse.json({ error: curOrgErr.message }, { status: 500 });
    }

    const orgId = curOrg?.[0]?.org_id ? String(curOrg[0].org_id) : null;
    if (!orgId) {
      return NextResponse.json(
        {
          org_id: null,
          plan_code: "free",
          stripe_subscription_id: null,
          unit_amount_cents: null,
          currency: null,
          interval: null,
          status: null,
        },
        { status: 200 }
      );
    }

    // 2) abonnement actif (source de vérité)
    const { data: subRows, error: subErr } = await admin
      .from("org_billing_subscriptions")
      .select(
        "plan_code,stripe_subscription_id,unit_amount_cents,currency,interval,status,updated_at"
      )
      .eq("org_id", orgId)
      .in("status", ["active", "trialing", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    const row = subRows?.[0];

    // fallback free si pas de ligne
    if (!row) {
      return NextResponse.json(
        {
          org_id: orgId,
          plan_code: "free",
          stripe_subscription_id: null,
          unit_amount_cents: null,
          currency: null,
          interval: null,
          status: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        org_id: orgId,
        plan_code: normalizePlan(row.plan_code),
        stripe_subscription_id: row.stripe_subscription_id ?? null,
        unit_amount_cents:
          typeof row.unit_amount_cents === "number" ? row.unit_amount_cents : null,
        currency: row.currency ?? null,
        interval: row.interval ?? null,
        status: row.status ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
