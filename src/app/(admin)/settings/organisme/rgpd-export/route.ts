import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function makePdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        autoFirstPage: true,
      });

      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);

      doc.pipe(stream);

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("DOCUMENT RGPD – EXPORT UTILISATEUR");
      doc.moveDown(1);

      doc.font("Helvetica").fontSize(11);

      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) {
          doc.moveDown(0.6);
          continue;
        }

        if (/^\d+\./.test(line)) {
          doc.moveDown(0.5);
          doc.font("Helvetica-Bold").fontSize(12).text(line);
          doc.font("Helvetica").fontSize(11);
        } else if (/^\s*-\s+/.test(line)) {
          doc.text("• " + line.replace(/^\s*-\s+/, ""), { indent: 12 });
        } else {
          doc.text(line);
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export async function GET() {
  const supabase = createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: orgId, error: orgIdErr } = await supabase.rpc("current_org_id");
  if (orgIdErr || !orgId) {
    return NextResponse.json({ error: "no_org_context" }, { status: 403 });
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ error: "org_fetch_failed" }, { status: 500 });
  }

  const email = userData.user.email ?? "";
  const orgName = org?.name ?? "";
  const date = new Date().toISOString().slice(0, 10);

  const text = `
Utilisateur : ${email}
Organisation : ${orgName}
Date : ${date}

1. DONNÉES COLLECTÉES
- Identité (nom, prénom, email)
- Données de compte et de connexion
- Organisations et rôles
- Activité (sessions, factures, invitations)

2. FINALITÉS
- Gestion des organismes de formation
- Gestion administrative et légale

3. DURÉES DE CONSERVATION
- Voir onglet retention_policy

4. DROITS UTILISATEUR
- Accès
- Rectification
- Suppression
- Opposition

5. PREUVE DE SUPPRESSION
- Journalisée dans rgpd_deletion_log
`.trim();

  const pdf = await makePdf(text);
  const filename = `rgpd-document-${date}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}