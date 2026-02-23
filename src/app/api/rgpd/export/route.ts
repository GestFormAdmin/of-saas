import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function makePdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    doc.pipe(stream);
    doc.fontSize(16).text("DOCUMENT RGPD – EXPORT UTILISATEUR");
    doc.moveDown();
    doc.fontSize(11).text(text);
    doc.end();
  });
}

export async function GET() {
const sb = await createSupabaseServerClient();

  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = data.user.email ?? "";
  const date = new Date().toISOString().slice(0, 10);

  const text = `
Utilisateur : ${email}
Date : ${date}

Données personnelles associées à votre compte.
  `.trim();

  const pdf = await makePdf(text);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rgpd-${date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}