// ✅ src/app/api/documents/attestation/[apprenantId]/route.ts
// REMPLACE 100% DU FICHIER PAR ÇA
// ✅ Corrections:
// - affiche CP + ville OF sur "Fait à"
// - évite les accès à products.action_type_label (chez toi ça n'existe pas)
// - garde ton process intact (view attestation_data en priorité, fallback safe)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

/* ===================== SUPABASE ===================== */

function supabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return createClient(url, anon, { auth: { persistSession: false } });
}

function supabaseAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/* ===================== HELPERS ===================== */

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function getApprenantIdFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return last;
}

function clean(v: string) {
  return (v || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function yyyymmdd(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function frDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
}

function asText(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function asMaybeText(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function numberLabel(v: any, fallback = "—") {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  if (!s) return fallback;
  return s;
}

function objectivesToText(obj: any) {
  if (!obj) return "—";

  if (typeof obj === "object" && !Array.isArray(obj)) {
    const t = (obj as any)?.text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }

  if (Array.isArray(obj)) {
    const items = obj.map((x) => String(x).trim()).filter(Boolean);
    return items.length ? items.join("\n") : "—";
  }

  if (typeof obj === "string") return obj.trim() || "—";

  return "—";
}

async function trySelectOne(
  sb: any,
  table: string,
  select: string,
  filters: Record<string, any>
): Promise<{ data: any | null; ok: boolean }> {
  try {
    let q = sb.from(table).select(select).limit(1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q.maybeSingle();
    if (error) return { data: null, ok: false };
    return { data: data ?? null, ok: true };
  } catch {
    return { data: null, ok: false };
  }
}

async function trySelectMany(
  sb: any,
  table: string,
  select: string,
  filters: Record<string, any>
): Promise<{ data: any[]; ok: boolean }> {
  try {
    let q = sb.from(table).select(select);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) return { data: [], ok: false };
    return { data: (data ?? []) as any[], ok: true };
  } catch {
    return { data: [], ok: false };
  }
}

/* ===================== ROUTE ===================== */

export async function GET(req: Request) {
  try {
    const apprenantId = getApprenantIdFromUrl(req.url).trim();

    if (!apprenantId || !isUuid(apprenantId)) {
      return new Response(JSON.stringify({ error: "missing_or_invalid_param" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    /* ================== AUTH ================== */
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sbAuth = supabaseAuth();
    const { data: userData, error: userErr } = await sbAuth.auth.getUser(token);

    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAuthed(token);

    /* ================== BASE DATA (VIEW) ================== */
    const { data: baseRow, error: baseErr } = await sb
      .from("attestation_data")
      .select("*")
      .eq("apprenant_id", apprenantId)
      .maybeSingle();

    if (baseErr || !baseRow) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const orgId = asMaybeText((baseRow as any).org_id);

    // apprenant
    const apprFirst = asText((baseRow as any).first_name);
    const apprLast = asText((baseRow as any).last_name);

    // lieu formation (view)
    const formationStreet = asText((baseRow as any).formation_address);
    const formationCP = asText((baseRow as any).formation_postal_code);
    const formationCity = asText((baseRow as any).formation_city);

    // dates (view)
    const startIso = ((baseRow as any).session_start_date ?? null) as string | null;
    const endIso = ((baseRow as any).session_end_date ?? null) as string | null;
    const startLabel = frDate(startIso);
    const endLabel = frDate(endIso);

    // durées (view)
    let hoursTotal: any = (baseRow as any).session_hours_total ?? null;
    let daysTotal: any = (baseRow as any).session_days_total ?? null;

    /* ================== ORG (PRIORITÉ VIEW) ================== */
    let orgName = asText((baseRow as any).org_name, "—");
    let orgCity = asText((baseRow as any).org_city, "—");
    let orgPostal = asText((baseRow as any).org_postal_code, "—");
let orgRep = asText((baseRow as any).org_representative_name, "—");

// sécurité : si vide (cas edge), on prend le user connecté
if (orgRep === "—") {
  const u = userData.user;
  const full = [u.user_metadata?.first_name, u.user_metadata?.last_name]
    .filter(Boolean)
    .join(" ");
  if (full) orgRep = full;
}
    // fallback minimal: org.name depuis organizations si view vide
    if (orgId && (orgName === "—" || !orgName)) {
      const r = await trySelectOne(sb, "organizations", "name", { id: orgId });
      if (r.ok && r.data?.name) orgName = asText(r.data.name, orgName);
    }

    /* ================== formation.name = sessions -> products.name (agrégé via pivot si dispo) ================== */
    let formationName = asText((baseRow as any).formation_name, "—");
    let pickedSessionId: string | null = null;

    const { data: piv, ok: pivOk } = await trySelectMany(sb, "apprenant_sessions", "session_id", {
      apprenant_id: apprenantId,
    });

    const sessionIds = pivOk ? Array.from(new Set(piv.map((x: any) => x.session_id).filter(Boolean))) : [];

    if (sessionIds.length > 0) {
      const { data: sIn, error: sInErr } = await sb
        .from("sessions")
        .select("id,end_date,start_date,product_id,session_type,delivery_type")
        .in("id", sessionIds);

      const sessions = (sInErr ? [] : (sIn ?? [])) as any[];

      sessions.sort((a, b) => {
        const ae = a?.end_date ? new Date(a.end_date).getTime() : 0;
        const be = b?.end_date ? new Date(b.end_date).getTime() : 0;
        if (be !== ae) return be - ae;
        const as = a?.start_date ? new Date(a.start_date).getTime() : 0;
        const bs = b?.start_date ? new Date(b.start_date).getTime() : 0;
        return bs - as;
      });

      pickedSessionId = sessions[0]?.id ?? null;

      // fallback action type depuis session si view vide
      if (actionTypeLabelEmpty((baseRow as any).action_type_label)) {
        const st = sessions[0]?.session_type ?? null;
        const dt = sessions[0]?.delivery_type ?? null;
        const pick = asMaybeText(st) || asMaybeText(dt);
        if (pick) {
          (baseRow as any).action_type_label = pick;
        }
      }

      const productIds = Array.from(new Set(sessions.map((s) => s.product_id).filter(Boolean)));
      if (productIds.length > 0) {
        const { data: pData, error: pErr } = await sb.from("products").select("id,name").in("id", productIds);
        if (!pErr) {
          const names = (pData ?? [])
            .map((p: any) => String(p?.name ?? "").trim())
            .filter(Boolean);
          const uniq = Array.from(new Set(names));
          if (uniq.length > 0) formationName = uniq.join(", ");
        }
      }
    }

    /* ================== objectives + type depuis products/sessions ================== */
    let objectivesText = asText((baseRow as any).formation_objectives, "—");
    let actionTypeLabel = asText((baseRow as any).action_type_label, "—");

    const fallbackSessionId = asMaybeText((baseRow as any).session_id);
    const realSessionId = pickedSessionId || fallbackSessionId;

    if (realSessionId) {
      const { data: sRow } = await trySelectOne(sb, "sessions", "product_id,session_type,delivery_type", {
        id: realSessionId,
      });

      const productId = asMaybeText((sRow as any)?.product_id);

      if (actionTypeLabel === "—") {
        const st = (sRow as any)?.session_type;
        const dt = (sRow as any)?.delivery_type;
        const pick = asMaybeText(st) || asMaybeText(dt);
        if (pick) actionTypeLabel = pick;
      }

      if (productId) {
        // ✅ on ne tente PAS action_type_label sur products (chez toi absent)
        const productSelects = [
          "objectives,type",
          "objective,type",
          "objectifs,type",
          "formation_objectives,type",
          "objectives",
          "objective",
          "objectifs",
          "formation_objectives",
          "type",
        ];

        for (const sel of productSelects) {
          const pr = await trySelectOne(sb, "products", sel, { id: productId });
          if (!pr.ok || !pr.data) continue;

          const p = pr.data as any;

          const obj = p.objectives ?? p.objective ?? p.objectifs ?? p.formation_objectives ?? null;
          if (obj !== null && obj !== undefined) {
            const txt = objectivesToText(obj);
            if (txt && txt !== "—") objectivesText = txt;
          }

          if (actionTypeLabel === "—") {
            const t = asMaybeText(p.type);
            if (t) actionTypeLabel = t;
          }

          if (objectivesText !== "—" && actionTypeLabel !== "—") break;
        }
      }

      // hours/days fallback (si tu ajoutes des colonnes plus tard, ça les prendra)
      if (!asMaybeText(hoursTotal) || !asMaybeText(daysTotal)) {
        const candidates = [
          "hours_total,days_total",
          "hours,days",
          "duration_hours_total,duration_days_total",
          "duration_hours,duration_days",
          "duree_heures,duree_jours",
          "hours_total_label,days_total_label",
          "session_hours_total,session_days_total",
        ];

        for (const sel of candidates) {
          const r = await trySelectOne(sb, "sessions", sel, { id: realSessionId });
          if (!r.ok || !r.data) continue;

          const obj = r.data as any;

          const h =
            obj.hours_total ??
            obj.hours ??
            obj.duration_hours_total ??
            obj.duration_hours ??
            obj.duree_heures ??
            obj.hours_total_label ??
            obj.session_hours_total ??
            null;

          const d =
            obj.days_total ??
            obj.days ??
            obj.duration_days_total ??
            obj.duration_days ??
            obj.duree_jours ??
            obj.days_total_label ??
            obj.session_days_total ??
            null;

          if (!asMaybeText(hoursTotal) && h !== null && h !== undefined && String(h).trim() !== "") hoursTotal = h;
          if (!asMaybeText(daysTotal) && d !== null && d !== undefined && String(d).trim() !== "") daysTotal = d;

          if (asMaybeText(hoursTotal) && asMaybeText(daysTotal)) break;
        }
      }
    }

    /* ================== PDF ================== */
    const hoursLabel = numberLabel(hoursTotal, "—");
    const daysLabel = numberLabel(daysTotal, "—");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const marginX = 60;
    let y = 780;

    const draw = (t: string, size = 11, bold = false) => {
      page.drawText(t, { x: marginX, y, size, font: bold ? fontBold : font });
      y -= size + 8;
    };

    const drawWrap = (t: string, max = 90) => {
      const text = String(t ?? "");
      const paragraphs = text.split("\n");
      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (test.length > max) {
            if (line) draw(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) draw(line);
        if (paragraphs.length > 1) y -= 2;
      }
    };

    draw("ATTESTATION INDIVIDUELLE DE FORMATION", 16, true);
    draw("");

    draw(`Je soussigné ${orgRep}, représentant de l’organisme de formation ${orgName},`);
    draw("atteste que :");
    draw(`${apprFirst} ${apprLast}`, 12, true);
    draw("a suivi la formation intitulée :");
    draw(formationName, 12, true);

    draw("");
    draw("Lieu de la formation :");
    draw(`${formationStreet}${formationStreet && formationCP !== "—" ? "," : ""} ${formationCP} ${formationCity}`.trim());

    draw("");
    draw("Dates de la formation :");
    draw(`du ${startLabel} au ${endLabel}`);

    draw("");
    draw("Durée de la formation :");
    draw(`${hoursLabel} heures sur ${daysLabel} jours`);

    draw("");
    draw("Type d’action de formation :");
    draw(actionTypeLabel);

    draw("");
    draw("Objectifs de la formation :");
    drawWrap(objectivesText);

    draw("");
    // ✅ "Fait à" avec CP + ville (si dispo)
    const faitA = `${orgPostal !== "—" && orgPostal ? `${orgPostal} ` : ""}${orgCity}`.trim();
    draw(`Fait à ${faitA || "—"},`);
    draw(`le ${endLabel || frDate(new Date().toISOString())}`);
    draw("");
    draw("Signature et cachet de l’organisme de formation");

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const endDate = endIso ? new Date(endIso) : new Date();
    const filename = `attestation_formation_${clean(formationName)}_${clean(apprLast)}_${yyyymmdd(endDate)}.pdf`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "server_error", details: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/* ===================== SMALL UTILS ===================== */

function actionTypeLabelEmpty(v: any) {
  const s = String(v ?? "").trim();
  return !s || s === "—";
}