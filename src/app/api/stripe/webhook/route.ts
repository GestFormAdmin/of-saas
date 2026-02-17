import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-07-30.basil",
});

function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY manquant dans .env.local" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      returnPath?: string;
      customerId?: string;
    };

    // ⚠️ Le portail Stripe nécessite un customer Stripe.
    // -> Idéalement tu le récupères depuis ta DB via l’utilisateur connecté.
    // Ici on attend customerId dans le body pour rester générique.
    const customerId = body.customerId;
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "customerId manquant. Passe customerId (Stripe) ou branche la route à ta DB/auth pour le retrouver.",
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}${body.returnPath || "/abonnement"}`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur Stripe portal" },
      { status: 500 }
    );
  }
}
