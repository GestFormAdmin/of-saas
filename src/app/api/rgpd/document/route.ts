export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

function wrapText(text: string, maxChars: number) {
  const words = (text || "").replace(/\r/g, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function defaultDoc() {
  return {
    title: "Information RGPD – Données personnelles",
    sections: [
      {
        title: "Responsable du traitement",
        body:
          "Le responsable du traitement est l’organisme affiché dans ce document. Il détermine les finalités et moyens du traitement via l’application FormaAdmin / TalentUpFP.",
      },
      {
        title: "Finalités des traitements",
        body:
          "Gestion des comptes et accès (authentification, RBAC, multi-organisation), gestion administrative et pédagogique (sessions, apprenants, clients), facturation (devis/factures), support et sécurité (journalisation et notifications d’accès).",
      },
      {
        title: "Catégories de données traitées",
        body:
          "Données d’identification (nom, prénom, email), coordonnées (téléphone), informations de facturation (adresse, SIRET, TVA), données de gestion (apprenants, sessions, clients, produits, factures, dépenses) selon votre utilisation.",
      },
      {
        title: "Base(s) légale(s)",
        body:
          "Exécution du contrat (fourniture du service), obligations légales (facturation/comptabilité), intérêt légitime (sécurité, prévention fraude), et/ou consentement lorsque requis.",
      },
      {
        title: "Destinataires",
        body:
          "Accès limité aux utilisateurs autorisés de l’organisation selon leurs rôles. Les prestataires techniques nécessaires à l’hébergement et au fonctionnement du service peuvent traiter des données en tant que sous-traitants.",
      },
      {
        title: "Sous-traitants et hébergement",
        body:
          "Le service s’appuie sur Supabase (base de données PostgreSQL avec RLS, authentification, stockage).",
      },
      {
        title: "Durées de conservation",
        body:
          "Les durées varient selon la nature des données et les obligations applicables. Les données peuvent être supprimées/anonymisées lors de la suppression du compte selon la procédure RGPD de l’application.",
      },
      {
        title: "Sécurité et confidentialité",
        body:
          "Séparation stricte des données par organisation, RLS PostgreSQL activé, RBAC SQL-driven, accès via RPC, aucune logique sensible côté client.",
      },
      {
        title: "Vos droits",
        body:
          "Vous disposez des droits d’accès, rectification, effacement, limitation, opposition et portabilité. Un export RGPD (Excel) est disponible dans l’application.",
      },
      {
        title: "Contact",
        body:
          "Pour toute demande relative à vos données, contactez le responsable du traitement au sein de l’organisme ou le support applicatif.",
      },
    ],
    footer:
      "Document généré automatiquement à la demande depuis l’espace Organisme. Conservez-le pour vos dossiers.",
  };
}


export async function GET(req: Request) {
  const debug = (msg: any, status = 500) =>
    NextResponse.json(
      { error: typeof msg === "string" ? msg : msg?.message ?? String(msg), stack: msg?.stack ?? null },
      { status }
    );

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return debug("Missing Authorization Bearer token", 401);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return debug(userErr?.message || "Auth session missing!", 401);

    const { data: orgId, error: orgErr } = await supabase.rpc("current_org_id");
    if (orgErr || !orgId) return debug(orgErr?.message || "No current org", 400);

    const { data: org, error: orgFetchErr } = await supabase
      .from("organizations")
      .select("id,name,org_type")
      .eq("id", orgId)
      .maybeSingle();
    if (orgFetchErr || !org) return debug(orgFetchErr?.message || "Org not found", 404);

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("first_name,last_name,phone,billing_street,billing_postal_code,billing_city,billing_siret,billing_vat")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profErr) return debug(profErr, 400);

    const { data: contentRaw, error: docErr } = await supabase.rpc("get_current_rgpd_document");
    if (docErr) return debug(docErr, 400);

    const doc = { ...defaultDoc(), ...(contentRaw || {}) };

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage();
    const margin = 48;
    let y = page.getSize().height - margin;

    const newPage = () => {
      page = pdf.addPage();
      y = page.getSize().height - margin;
    };

    const drawLine = (txt: string, isBold = false, size = 11) => {
      if (y < margin + 40) newPage();
      page.drawText(txt, { x: margin, y, size, font: isBold ? fontBold : font });
      y -= size + 6;
    };

    const drawParagraph = (txt: string, size = 11) => {
      const lines = wrapText(txt, 95);
      for (const line of lines) {
        if (y < margin + 40) newPage();
        page.drawText(line, { x: margin, y, size, font });
        y -= size + 6;
      }
      y -= 6;
    };

    drawLine(String(doc.title || "Document RGPD"), true, 18);
    drawLine(`Organisation : ${org.name || "—"} (${org.org_type || "—"})`, false, 11);
    drawLine(
      `Utilisateur : ${(`${profile?.first_name || ""} ${profile?.last_name || ""}`).trim() || "—"}`,
      false,
      11
    );
    drawLine(`Email : ${userData.user.email || "—"}`, false, 11);
    drawLine(`Généré le : ${new Date().toISOString().slice(0, 10)}`, false, 11);

    y -= 10;

    drawLine("Informations (profil)", true, 12);
    drawLine(`Téléphone : ${profile?.phone || "—"}`, false, 11);
    drawLine(
      `Adresse : ${(`${profile?.billing_street || ""} ${profile?.billing_postal_code || ""} ${profile?.billing_city || ""}`).trim() || "—"}`,
      false,
      11
    );
    drawLine(`SIRET : ${profile?.billing_siret || "—"}`, false, 11);
    drawLine(`TVA : ${profile?.billing_vat || "—"}`, false, 11);

    y -= 10;

    const sections = Array.isArray(doc.sections) ? doc.sections : [];
    for (const s of sections) {
      drawLine(String(s?.title || "—"), true, 13);
      drawParagraph(String(s?.body || "").trim(), 11);
    }

    const footer = String(doc.footer || "").trim();
    if (footer) {
      drawLine("Note", true, 12);
      drawParagraph(footer, 10);
    }

    const bytes = await pdf.save();

    const yyyy_mm_dd = new Date().toISOString().slice(0, 10);
    const safeOrg = (org.name || "org").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const filename = `rgpd-document-${safeOrg}-${yyyy_mm_dd}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return debug(e, 500);
  }
}
