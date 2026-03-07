// src/features/apprenants/components/ApprenantsBase.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ================== TYPES ================== */

type ApprenantViewRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  end_date: string | null;
  forprev: boolean | null;
  candidate_manual_validated: boolean | null;

  formations?: string;
  client_name?: string | null;
  session_label?: string | null;

  street?: string | null;
  postal_code?: string | null;
  city?: string | null;

  formation_hours_total?: number | null;
  formation_days_total?: number | null;
  formation_objectives?: string | null;
};

type Client = { id: string; name: string };
type Produit = { id: string; name: string };
type Competence = { id: string; label: string };

type Session = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  product_id: string | null;
  client_id: string | null;

  location_structure: string | null;
  location_street: string | null;
  location_postal_code: string | null;
  location_city: string | null;

  product?: { id: string; name: string } | null;
};

type ApprenantDb = {
  id: string;

  last_name: string | null;
  first_name: string | null;
  birth_date: string | null;
  email: string | null;

  product_id: string | null;
  client_id: string | null;
  structure: string | null;

  start_date: string | null;
  end_date: string | null;

  street: string | null;
  postal_code: string | null;
  city: string | null;

  forprev: boolean | null;
  candidate_manual_validated: boolean | null;

  apprenant_competences?: Array<{ competence_id: string; validated: boolean }>;
  apprenant_sessions?: Array<{ session_id: string }>;
};

type FormState = {
  last_name: string;
  first_name: string;
  birth_date: string | null;
  email: string | null;

  product_id: string | null;
  client_id: string | null;
  structure: string | null;

  start_date: string | null;
  end_date: string | null;

  street: string | null;
  postal_code: string | null;
  city: string | null;

  forprev: boolean | null;
  candidate_manual_validated: boolean;
};

type MultiRow = {
  key: string;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  email: string | null;
};

type ProductStat = {
  product_id: string;
  product_name: string;
  total: number;
  validated: number;
  rate: number;
};

type ColKey =
  | "last_name"
  | "first_name"
  | "client"
  | "session"
  | "formation"
  | "address"
  | "duration_h"
  | "duration_d"
  | "objectives"
  | "end_date"
  | "validated"
  | "forprev";

type SortState = { key: ColKey; dir: "asc" | "desc" };

/* ================== HELPERS ================== */

function errorToMessage(err: any): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;

  const msg = err?.message || err?.error_description || err?.details || err?.hint;
  if (msg) return String(msg);

  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err));
  } catch {
    try {
      return String(err);
    } catch {
      return "Erreur inconnue";
    }
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toFrDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function yearOf(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

function yesNo(v: boolean | null | undefined) {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "N.C";
}

function required(v: string) {
  return v.trim().length > 0;
}

function makeKey() {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID() as string;
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function modalTitle(mode: "create" | "edit" | "view" | "multi") {
  if (mode === "multi") return "Ajout multiple";
  if (mode === "create") return "Nouvel apprenant";
  if (mode === "edit") return "Modifier apprenant";
  return "Voir apprenant";
}

async function downloadAttestation(apprenantId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    alert("Session expirée, reconnecte-toi.");
    return;
  }

  const url = `/api/documents/attestation/${apprenantId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/pdf",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[attestation] HTTP", res.status, res.statusText, txt);
    alert(`Erreur attestation (${res.status})\n\n${txt.slice(0, 800) || "—"}`);
    return;
  }

  const cd = res.headers.get("content-disposition") || "";
  const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? "attestation.pdf";

  const blob = await res.blob();
  const dlUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(dlUrl);
}

function isValidatedRow(r: ApprenantViewRow) {
  return r.candidate_manual_validated === true;
}

/* ================== UI ================== */

function StatCard({
  title,
  value,
  subline,
  prevline,
  tone,
  icon,
}: {
  title: string;
  value: string;
  subline?: string;
  prevline?: string;
  tone: "green" | "orange" | "blue" | "red";
  icon: string;
}) {
  const toneMap: Record<typeof tone, { bg: string; iconBg: string; border: string }> = {
    green: { bg: "rgba(34,197,94,.10)", iconBg: "rgb(34,197,94)", border: "rgba(34,197,94,.18)" },
    orange: { bg: "rgba(245,158,11,.12)", iconBg: "rgb(245,158,11)", border: "rgba(245,158,11,.18)" },
    blue: { bg: "rgba(59,130,246,.10)", iconBg: "rgb(59,130,246)", border: "rgba(59,130,246,.18)" },
    red: { bg: "rgba(239,68,68,.10)", iconBg: "rgb(239,68,68)", border: "rgba(239,68,68,.18)" },
  };

  const t = toneMap[tone];

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 18,
        background: t.bg,
        border: `1px solid ${t.border}`,
        boxShadow: "0 1px 12px rgba(0,0,0,.04)",
        minHeight: 110,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.75 }}>{title}</div>

      <div style={{ fontSize: 36, fontWeight: 950, marginTop: 10, letterSpacing: -0.6, lineHeight: 1.05 }}>
        {value}
      </div>

      <div style={{ fontSize: 13, fontWeight: 850, opacity: 0.7, marginTop: 10 }}>{subline ?? " "}</div>
      <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.45, marginTop: 4 }}>{prevline ?? " "}</div>

      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 46,
          height: 46,
          borderRadius: 16,
          background: t.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 24px rgba(0,0,0,.10)",
          fontSize: 20,
        }}
        aria-hidden
      >
        {icon}
      </div>
    </div>
  );
}

function SoftButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted/20 disabled:opacity-50 ${
        className ?? ""
      }`}
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 ${
        className ?? ""
      }`}
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${className ?? ""}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${className ?? ""}`} />;
}

function ForprevPill({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const v: boolean | null = value === undefined ? null : value;

  const nextValue = (cur: boolean | null) => {
    if (cur === null) return true;
    if (cur === true) return false;
    return null;
  };

  const label = v === true ? "Oui" : v === false ? "Non" : "N.C";

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: size === "sm" ? 26 : 30,
    padding: size === "sm" ? "0 10px" : "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.14)",
    background: v === true ? "rgba(34,197,94,.12)" : v === false ? "rgba(239,68,68,.12)" : "rgba(148,163,184,.18)",
    color: v === true ? "rgb(21,128,61)" : v === false ? "rgb(185,28,28)" : "rgb(51,65,85)",
    fontSize: 12,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(nextValue(v))}
      style={style}
      title="Cliquer pour changer : N.C → Oui → Non"
    >
      {label}
    </button>
  );
}

/* ================== CONSTS ================== */

const EMPTY_FORM: FormState = {
  last_name: "",
  first_name: "",
  birth_date: null,
  email: null,
  product_id: null,
  client_id: null,
  structure: null,
  start_date: null,
  end_date: null,
  street: null,
  postal_code: null,
  city: null,
  forprev: null,
  candidate_manual_validated: false,
};

const EMPTY_MULTI_ROW: MultiRow = {
  key: makeKey(),
  last_name: "",
  first_name: "",
  birth_date: null,
  email: null,
};

const STORAGE_KEY = "apprenants_table_columns_v4";

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: "last_name", label: "Nom" },
  { key: "first_name", label: "Prénom" },
  { key: "client", label: "Client" },
  { key: "session", label: "Session" },
  { key: "formation", label: "Formation" },
  { key: "address", label: "Adresse" },
  { key: "duration_h", label: "Durée (h)" },
  { key: "duration_d", label: "Durée (jours)" },
  { key: "objectives", label: "Objectifs" },
  { key: "end_date", label: "Certification" },
  { key: "validated", label: "Validé" },
  { key: "forprev", label: "FORPREV" },
];
export default function ApprenantsPageClient() {
  const searchParams = useSearchParams();

  const [multiCtx, setMultiCtx] = useState<{
    session_id: string;
    product_id?: string;
    client_id?: string;
    start_date?: string;
    end_date?: string;
    structure?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApprenantViewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const hideId = (id: string) => setHiddenIds((p) => new Set(p).add(id));
  const unhideId = (id: string) =>
    setHiddenIds((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [competences, setCompetences] = useState<Competence[]>([]);
  const [compChecks, setCompChecks] = useState<Record<string, boolean>>({});

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [openCreate, setOpenCreate] = useState(false);
  const [openMulti, setOpenMulti] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [multiRows, setMultiRows] = useState<MultiRow[]>([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [multiSaving, setMultiSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprenantDb | null>(null);

  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [productStatsLoading, setProductStatsLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [filterValidated, setFilterValidated] = useState<"all" | "yes" | "no">("all");
  const [filterForprev, setFilterForprev] = useState<"all" | "yes" | "no" | "nc">("all");

  const [sort, setSort] = useState<SortState>({ key: "last_name", dir: "asc" });
  const [isGuestUser, setIsGuestUser] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (!uid) {
          setIsGuestUser(true);
          return;
        }

        const { data, error } = await supabase
          .from("memberships")
          .select("id, role, status")
          .eq("user_id", uid)
          .eq("status", "active")
          .limit(1);

        if (error) {
          setIsGuestUser(true);
          return;
        }

        setIsGuestUser((data ?? []).length === 0);
      } catch {
        setIsGuestUser(true);
      }
    })();
  }, []);

  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => {
    const base = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, true])) as Record<ColKey, boolean>;
    if (typeof window === "undefined") return base;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      return { ...base, ...parsed };
    } catch {
      return base;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols));
    } catch {}
  }, [visibleCols]);

  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => visibleCols[c.key]), [visibleCols]);

  const certifAutoLabel = useMemo(() => toFrDate(form.end_date), [form.end_date]);

  const candidateComputed = useMemo(() => {
    if (competences.length > 0) return competences.every((c) => compChecks[c.id] === true);
    return !!form.candidate_manual_validated;
  }, [competences, compChecks, form.candidate_manual_validated]);

  const toggleSort = (key: ColKey) => {
    setSort((prev) => {
      if (prev.key !== key) {
        const defaultDir: Record<ColKey, "asc" | "desc"> = {
          last_name: "asc",
          first_name: "asc",
          client: "asc",
          session: "asc",
          formation: "asc",
          address: "asc",
          duration_h: "desc",
          duration_d: "desc",
          objectives: "asc",
          end_date: "desc",
          validated: "desc",
          forprev: "desc",
        };
        return { key, dir: defaultDir[key] };
      }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const kpi = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const prevYear = nowYear - 1;

    const isYear = (r: ApprenantViewRow, y: number) => yearOf(r.end_date) === y;

    const totalNow = rows.filter((r) => isYear(r, nowYear)).length;
    const totalPrev = rows.filter((r) => isYear(r, prevYear)).length;

    const validatedNow = rows.filter((r) => isYear(r, nowYear) && isValidatedRow(r)).length;
    const validatedPrev = rows.filter((r) => isYear(r, prevYear) && isValidatedRow(r)).length;

    const rateNow = pct(validatedNow, totalNow);
    const ratePrev = pct(validatedPrev, totalPrev);

    const forprevNoNow = rows.filter((r) => isYear(r, nowYear) && r.forprev === false).length;
    const forprevNoPrev = rows.filter((r) => isYear(r, prevYear) && r.forprev === false).length;

    return {
      nowYear,
      prevYear,
      totalNow,
      totalPrev,
      validatedNow,
      validatedPrev,
      rateNow,
      ratePrev,
      forprevNoNow,
      forprevNoPrev,
    };
  }, [rows]);

  const ensureOrgContext = async (_orgId: string) => {
    const { error: e } = await supabase.rpc("set_current_org", { p_org_id: _orgId });

    if (e && /function .*set_current_org/i.test(e.message)) return true;
    if (e && /forbidden|permission|not allowed|not authorized|403/i.test(e.message)) return true;

    if (e) {
      setError(`Contexte org: ${errorToMessage(e)}`);
      return false;
    }

    return true;
  };

  const getOrgId = async () => {
    const { data: orgId, error: e } = await supabase.rpc("current_org_id");
    if (e || !orgId) return null;

    const ok = await ensureOrgContext(orgId as string);
    if (!ok) return null;

    return orgId as string;
  };

  const loadRefs = async () => {
    const clientsRes = await supabase.from("clients").select("id,name").order("name");
    if (clientsRes.error) setError("Clients: " + errorToMessage(clientsRes.error));
    setClients((clientsRes.data ?? []) as Client[]);

    const produitsRes = await supabase.from("products").select("id,name").order("name");
    if (produitsRes.error) setError("Produits: " + errorToMessage(produitsRes.error));
    setProduits((produitsRes.data ?? []) as Produit[]);
  };

  const fetchProductsMeta = async (productIds: string[]) => {
    const out = {
      objectivesById: new Map<string, string>(),
      hoursById: new Map<string, number>(),
      daysById: new Map<string, number>(),
      nameById: new Map<string, string>(),
    };

    if (productIds.length === 0) return out;

    const { data, error } = await supabase
      .from("products")
      .select("id,name,duration_hours,objective,objectives")
      .in("id", productIds);

    if (error) return out;

    (data ?? []).forEach((p: any) => {
      const id = p?.id as string | undefined;
      if (!id) return;

      const name = typeof p?.name === "string" ? p.name : "";
      if (name) out.nameById.set(id, name);

      const h = typeof p?.duration_hours === "number" ? (p.duration_hours as number) : null;
      if (h !== null) out.hoursById.set(id, h);

      const objText = typeof p?.objective === "string" ? p.objective.trim() : "";
      if (objText) {
        out.objectivesById.set(id, objText);
        return;
      }

      const objJson = p?.objectives ?? null;
      if (objJson) {
        try {
          const s = typeof objJson === "string" ? objJson : JSON.stringify(objJson);
          if (s && s.trim()) out.objectivesById.set(id, s);
        } catch {}
      }
    });

    return out;
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    const { data: base, error: baseErr } = await supabase
      .from("apprenants_view")
      .select("id,last_name,first_name,email,end_date,forprev,candidate_manual_validated")
      .order("last_name");

    if (baseErr) {
      setError(errorToMessage(baseErr));
      setRows([]);
      setLoading(false);
      return;
    }

    const baseRows = (base ?? []) as ApprenantViewRow[];
    const baseIds = baseRows.map((r) => r.id);

    if (baseIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: apprData, error: apprDataErr } = await supabase
      .from("apprenants")
      .select("id, client_id, product_id, street, postal_code, city")
      .in("id", baseIds);

    if (apprDataErr) {
      setError(errorToMessage(apprDataErr));
      setRows(baseRows.filter((r) => !hiddenIds.has(r.id)));
      setLoading(false);
      return;
    }

    const apprById = new Map<
      string,
      {
        client_id: string | null;
        product_id: string | null;
        street: string | null;
        postal_code: string | null;
        city: string | null;
      }
    >();

    (apprData ?? []).forEach((a: any) => {
      apprById.set(a.id, {
        client_id: a.client_id ?? null,
        product_id: a.product_id ?? null,
        street: a.street ?? null,
        postal_code: a.postal_code ?? null,
        city: a.city ?? null,
      });
    });

    const clientIds = Array.from(new Set((apprData ?? []).map((a: any) => a.client_id).filter(Boolean)));
    const clientNameById = new Map<string, string>();

    if (clientIds.length > 0) {
      const { data: cData, error: cErr } = await supabase.from("clients").select("id,name").in("id", clientIds);
      if (cErr) setError(errorToMessage(cErr));
      (cData ?? []).forEach((c: any) => clientNameById.set(c.id, c.name ?? "—"));
    }

    const clientNameByAppr = new Map<string, string | null>();
    baseRows.forEach((r) => {
      const meta = apprById.get(r.id);
      const cid = meta?.client_id ?? null;
      clientNameByAppr.set(r.id, cid ? clientNameById.get(cid) ?? null : null);
    });

    const { data: piv, error: pivErr } = await supabase
      .from("apprenant_sessions")
      .select("apprenant_id, session_id")
      .in("apprenant_id", baseIds);

    const fallbackProductIds = Array.from(
      new Set(baseRows.map((r) => apprById.get(r.id)?.product_id ?? null).filter(Boolean))
    ) as string[];
    const fallbackMeta = await fetchProductsMeta(fallbackProductIds);

    if (pivErr) {
      setError(errorToMessage(pivErr));
      setRows(
        baseRows
          .map((r) => {
            const pid = apprById.get(r.id)?.product_id ?? null;
            return {
              ...r,
              client_name: clientNameByAppr.get(r.id) ?? null,
              session_label: null,
              formations: pid ? fallbackMeta.nameById.get(pid) ?? "" : "",
              street: apprById.get(r.id)?.street ?? null,
              postal_code: apprById.get(r.id)?.postal_code ?? null,
              city: apprById.get(r.id)?.city ?? null,
              formation_objectives: pid ? fallbackMeta.objectivesById.get(pid) ?? null : null,
              formation_hours_total: pid ? fallbackMeta.hoursById.get(pid) ?? null : null,
              formation_days_total: null,
            };
          })
          .filter((r) => !hiddenIds.has(r.id))
      );
      setLoading(false);
      return;
    }

    const sessionIds = Array.from(new Set((piv ?? []).map((x: any) => x.session_id).filter(Boolean)));

   const sessionNameById = new Map<string, string>();
const sessionProductById = new Map<string, string>();
const sessionAddressById = new Map<
  string,
  { street: string | null; postal_code: string | null; city: string | null }
>();

if (sessionIds.length > 0) {
  const { data: sData, error: sErr } = await supabase
    .from("sessions")
    .select("id,name,product_id,location_street,location_postal_code,location_city")
    .in("id", sessionIds);

  if (sErr) setError(errorToMessage(sErr));

  (sData ?? []).forEach((s: any) => {
    if (!s?.id) return;
    sessionNameById.set(s.id, s.name ?? "—");
    if (s.product_id) sessionProductById.set(s.id, s.product_id);
    sessionAddressById.set(s.id, {
      street: s.location_street ?? null,
      postal_code: s.location_postal_code ?? null,
      city: s.location_city ?? null,
    });
  });
}
    const sessionObjsByAppr = new Map<
  string,
  {
    name: string;
    product_id: string | null;
    street: string | null;
    postal_code: string | null;
    city: string | null;
  }[]
>();

(piv ?? []).forEach((x: any) => {
  const aid = x.apprenant_id as string;
  const sid = x.session_id as string;
  const name = sessionNameById.get(sid) ?? "—";
  const pid = sessionProductById.get(sid) ?? null;
  const addr = sessionAddressById.get(sid) ?? {
    street: null,
    postal_code: null,
    city: null,
  };

  const arr = sessionObjsByAppr.get(aid) ?? [];
  arr.push({
    name,
    product_id: pid,
    street: addr.street,
    postal_code: addr.postal_code,
    city: addr.city,
  });
  sessionObjsByAppr.set(aid, arr);
});

    const sessionProductIds = Array.from(new Set(Array.from(sessionProductById.values()).filter(Boolean))) as string[];
    const sessionMeta = await fetchProductsMeta(sessionProductIds);

   const enriched = baseRows.map((r) => {
  const sess = sessionObjsByAppr.get(r.id) ?? [];
  const session_label =
    sess.length === 0 ? null : sess.length === 1 ? (sess[0].name ?? "—") : `${sess.length} sessions`;

  const prodIds = sess.map((s) => s.product_id).filter(Boolean) as string[];
  const uniqProdIds = Array.from(new Set(prodIds));

  const formations = Array.from(
    new Set(prodIds.map((pid) => (sessionMeta.nameById.get(pid) ?? "").trim()).filter(Boolean))
  ).join(", ");

  const chosenPid = uniqProdIds.length === 1 ? uniqProdIds[0] : apprById.get(r.id)?.product_id ?? null;

  const objectives = chosenPid
    ? sessionMeta.objectivesById.get(chosenPid) ?? fallbackMeta.objectivesById.get(chosenPid) ?? null
    : null;

  const hours = chosenPid
    ? sessionMeta.hoursById.get(chosenPid) ?? fallbackMeta.hoursById.get(chosenPid) ?? null
    : null;

  const apprStreet = apprById.get(r.id)?.street ?? null;
  const apprPostalCode = apprById.get(r.id)?.postal_code ?? null;
  const apprCity = apprById.get(r.id)?.city ?? null;

  const firstSessionWithAddress =
    sess.find((s) => (s.street ?? "").trim() || (s.postal_code ?? "").trim() || (s.city ?? "").trim()) ?? null;

  return {
    ...r,
    client_name: clientNameByAppr.get(r.id) ?? null,
    session_label,
    street: apprStreet ?? firstSessionWithAddress?.street ?? null,
    postal_code: apprPostalCode ?? firstSessionWithAddress?.postal_code ?? null,
    city: apprCity ?? firstSessionWithAddress?.city ?? null,
    formations: (formations ?? "").trim()
      ? formations
      : chosenPid
        ? sessionMeta.nameById.get(chosenPid) ?? fallbackMeta.nameById.get(chosenPid) ?? ""
        : "",
    formation_objectives: objectives,
    formation_hours_total: typeof hours === "number" ? hours : null,
    formation_days_total: null,
  };
});

    setRows(enriched.filter((x) => !hiddenIds.has(x.id)));
    setLoading(false);

    void loadProductStats(enriched);
  };
    const loadProductStats = async (sourceRows?: ApprenantViewRow[]) => {
    setProductStatsLoading(true);
    setError(null);

    try {
      const base = sourceRows ?? rows;
      if (!base || base.length === 0) {
        setProductStats([]);
        return;
      }

      const apprIds = Array.from(new Set(base.map((r) => r.id).filter(Boolean)));
      if (apprIds.length === 0) {
        setProductStats([]);
        return;
      }

      const orgId = await getOrgId();
      if (!orgId) {
        setProductStats([]);
        return;
      }

      const { data: apprAll, error: e1 } = await supabase
        .from("apprenants")
        .select("id, candidate_manual_validated")
        .in("id", apprIds);

      if (e1) {
        setError(errorToMessage(e1));
        setProductStats([]);
        return;
      }

      const { data: pivData, error: pivErr } = await supabase
        .from("apprenant_competences")
        .select("apprenant_id, validated")
        .in("apprenant_id", apprIds);

      if (pivErr) {
        setError(errorToMessage(pivErr));
        setProductStats([]);
        return;
      }

      const compsByAppr = new Map<string, boolean[]>();
      (pivData ?? []).forEach((r: any) => {
        const arr = compsByAppr.get(r.apprenant_id) ?? [];
        arr.push(r.validated === true);
        compsByAppr.set(r.apprenant_id, arr);
      });

      const formationsByAppr = new Map<string, string[]>();
      base.forEach((r) => {
        if (!r.formations) return;
        const list = r.formations
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (list.length > 0) formationsByAppr.set(r.id, list);
      });

      const map = new Map<string, { name: string; total: number; validated: number }>();

      (apprAll ?? []).forEach((a: any) => {
        const formations = formationsByAppr.get(a.id);
        if (!formations || formations.length === 0) return;

        const comps = compsByAppr.get(a.id) ?? [];
        const isValidated = a.candidate_manual_validated === true || (comps.length > 0 && comps.every(Boolean));

        formations.forEach((name) => {
          const prev = map.get(name) ?? { name, total: 0, validated: 0 };
          prev.total += 1;
          if (isValidated) prev.validated += 1;
          map.set(name, prev);
        });
      });

      const stats: ProductStat[] = Array.from(map.entries()).map(([name, v]) => ({
        product_id: name,
        product_name: name,
        total: v.total,
        validated: v.validated,
        rate: v.total > 0 ? Math.round((v.validated / v.total) * 100) : 0,
      }));

      stats.sort((a, b) => a.product_name.localeCompare(b.product_name));
      const visibleStats = stats.filter((s) => s.total > 0);
      setProductStats(visibleStats);
    } finally {
      setProductStatsLoading(false);
    }
  };

  const loadCompetencesForProduct = async (productId: string | null, seedChecks?: Record<string, boolean>) => {
    if (!productId) {
      setCompetences([]);
      setCompChecks({});
      return;
    }

    const { data, error: e } = await supabase
      .from("competences")
      .select("id,label")
      .eq("product_id", productId)
      .order("label");

    if (e) {
      setError(errorToMessage(e));
      setCompetences([]);
      setCompChecks({});
      return;
    }

    const comps = (data ?? []) as Competence[];
    setCompetences(comps);

    const init: Record<string, boolean> = {};
    comps.forEach((c) => (init[c.id] = false));
    if (seedChecks) {
      Object.keys(seedChecks).forEach((k) => {
        if (k in init) init[k] = seedChecks[k] === true;
      });
    }
    setCompChecks(init);
  };

  const loadSessionsForEndDate = async (endDate: string) => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const orgId = await getOrgId();
      if (!orgId) {
        setSessions([]);
        return;
      }

      const { data, error: qErr } = await supabase
        .from("sessions")
        .select(
          `
            id,
            name,
            start_date,
            end_date,
            product_id,
            client_id,
            location_structure,
            location_street,
            location_postal_code,
            location_city,
            product:products (
              id,
              name
            )
          `
        )
        .eq("end_date", endDate)
        .order("start_date", { ascending: false });

      if (qErr) {
        setSessions([]);
        setSessionsError(errorToMessage(qErr));
        return;
      }

      setSessions((data ?? []) as unknown as Session[]);
    } catch (e: any) {
      setSessions([]);
      setSessionsError(errorToMessage(e));
    } finally {
      setSessionsLoading(false);
    }
  };

  const applySessionToForm = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return;

    setSelectedSessionIds((prev) => {
      if (openMulti) return [sessionId];
      return prev.includes(sessionId) ? prev : [...prev, sessionId];
    });

    setForm((prev) => ({
      ...prev,
      product_id: s.product_id ?? prev.product_id ?? null,
      client_id: s.client_id ?? prev.client_id ?? null,
      structure: s.location_structure ?? prev.structure ?? null,
      street: s.location_street ?? prev.street ?? null,
      postal_code: s.location_postal_code ?? prev.postal_code ?? null,
      city: s.location_city ?? prev.city ?? null,
      start_date: s.start_date ?? prev.start_date ?? null,
      end_date: s.end_date ?? prev.end_date ?? null,
    }));
  };

  useEffect(() => {
    void (async () => {
      await loadRefs();
      await loadRows();
    })();
  }, []);

  useEffect(() => {
    if (!openCreate && !openEdit && !openMulti) return;
    void loadCompetencesForProduct(form.product_id, undefined);
  }, [form.product_id, openCreate, openEdit, openMulti]);

  useEffect(() => {
    if (!openCreate && !openEdit && !openMulti) return;

    if (!form.end_date) {
      setSessions([]);
      setSessionsLoading(false);
      setSessionsError(null);
      return;
    }

    void loadSessionsForEndDate(form.end_date);
  }, [form.end_date, openCreate, openEdit, openMulti]);

  const openCreateModal = () => {
    setSelected(null);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setCompetences([]);
    setCompChecks({});
    setSelectedSessionIds([]);
    setSessions([]);
    setSessionsError(null);
    setOpenCreate(true);
  };

  const openMultiModal = () => {
    setSelected(null);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setCompetences([]);
    setCompChecks({});
    setSelectedSessionIds([]);
    setSessions([]);
    setSessionsError(null);
    setMultiCtx(null);
    setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
    setMultiError(null);
    setOpenMulti(true);
  };

  useEffect(() => {
    const multi = searchParams.get("multi");
    const session_id = searchParams.get("session_id");
    if (multi !== "1" || !session_id) return;

    const product_id = searchParams.get("product_id") || "";
    const client_id = searchParams.get("client_id") || "";
    const start_date = searchParams.get("start_date") || "";
    const end_date = searchParams.get("end_date") || "";
    const structure = searchParams.get("structure") || "";

    setMultiCtx({
      session_id,
      product_id,
      client_id,
      start_date,
      end_date,
      structure,
    });

    setForm({
      ...EMPTY_FORM,
      product_id: product_id || null,
      client_id: client_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      structure: structure || null,
    });

    setSelectedSessionIds([session_id]);
    setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
    setMultiError(null);
    setOpenMulti(true);

    const url = new URL(window.location.href);
    url.searchParams.delete("multi");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams]);

  const openViewModal = async (id: string) => {
  setError(null);

  try {
    const { data, error: e } = await supabase
      .from("apprenants")
      .select("*, apprenant_competences(competence_id, validated), apprenant_sessions(session_id)")
      .eq("id", id)
      .maybeSingle();

    if (e || !data) {
      setError(e ? errorToMessage(e) : "Erreur chargement apprenant");
      return;
    }

    const a = data as ApprenantDb;

    const hasOwnAddress =
      (a.street ?? "").trim() || (a.postal_code ?? "").trim() || (a.city ?? "").trim();

    if (!hasOwnAddress) {
      const linkedSessionIds = (a.apprenant_sessions ?? []).map((x) => x.session_id).filter(Boolean);

      if (linkedSessionIds.length > 0) {
        const { data: sData } = await supabase
          .from("sessions")
          .select("id, location_street, location_postal_code, location_city")
          .in("id", linkedSessionIds);

        const s = (sData ?? []).find(
          (x: any) =>
            (x.location_street ?? "").trim() ||
            (x.location_postal_code ?? "").trim() ||
            (x.location_city ?? "").trim()
        ) as any;

        if (s) {
          a.street = a.street ?? s.location_street ?? null;
          a.postal_code = a.postal_code ?? s.location_postal_code ?? null;
          a.city = a.city ?? s.location_city ?? null;
        }
      }
    }

    setSelected(a);
    setSelectedId(id);
    setOpenView(true);
  } catch (e: any) {
    setError(errorToMessage(e));
  }
};

  const openEditModal = async (id: string) => {
    setError(null);

    try {
      const { data, error: e } = await supabase
        .from("apprenants")
        .select("*, apprenant_competences(competence_id, validated), apprenant_sessions(session_id)")
        .eq("id", id)
        .maybeSingle();

      if (e || !data) {
        setError(e ? errorToMessage(e) : "Erreur chargement apprenant");
        return;
      }

      const a = data as ApprenantDb;

const hasOwnAddress =
  (a.street ?? "").trim() || (a.postal_code ?? "").trim() || (a.city ?? "").trim();

if (!hasOwnAddress) {
  const linkedSessionIds = (a.apprenant_sessions ?? []).map((x) => x.session_id).filter(Boolean);

  if (linkedSessionIds.length > 0) {
    const { data: sData } = await supabase
      .from("sessions")
      .select("id, location_street, location_postal_code, location_city")
      .in("id", linkedSessionIds);

    const s = (sData ?? []).find(
      (x: any) =>
        (x.location_street ?? "").trim() ||
        (x.location_postal_code ?? "").trim() ||
        (x.location_city ?? "").trim()
    ) as any;

    if (s) {
      a.street = a.street ?? s.location_street ?? null;
      a.postal_code = a.postal_code ?? s.location_postal_code ?? null;
      a.city = a.city ?? s.location_city ?? null;
    }
  }
}

      setSelected(a);
      setSelectedId(a.id);

      setForm({
        last_name: a.last_name ?? "",
        first_name: a.first_name ?? "",
        birth_date: a.birth_date ?? null,
        email: a.email ?? null,
        product_id: a.product_id ?? null,
        client_id: a.client_id ?? null,
        structure: a.structure ?? null,
        start_date: a.start_date ?? null,
        end_date: a.end_date ?? null,
        street: a.street ?? null,
        postal_code: a.postal_code ?? null,
        city: a.city ?? null,
        forprev: a.forprev ?? null,
        candidate_manual_validated: a.candidate_manual_validated === true,
      });

      const seed: Record<string, boolean> = {};
      (a.apprenant_competences ?? []).forEach((x) => {
        seed[x.competence_id] = x.validated === true;
      });
      await loadCompetencesForProduct(a.product_id ?? null, seed);

      const linked = (a.apprenant_sessions ?? []).map((x) => x.session_id);
      setSelectedSessionIds(linked);

      setSessions([]);
      setSessionsError(null);
      setOpenEdit(true);
    } catch (e: any) {
      setError(errorToMessage(e));
    }
  };

  const saveCreate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      if (!required(form.last_name) || !required(form.first_name)) {
        setError("Nom et prénom requis.");
        return;
      }

      const orgId = await getOrgId();
      if (!orgId) return;

      const payloadForRpc = {
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        birth_date: form.birth_date || null,
        email: form.email?.trim() || null,
        product_id: form.product_id,
        client_id: form.client_id,
        structure: form.structure?.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        street: form.street?.trim() || null,
        postal_code: form.postal_code?.trim() || null,
        city: form.city?.trim() || null,
        forprev: form.forprev,
        candidate_manual_validated: !!form.candidate_manual_validated,
      };

      const { data: inserted, error: insErr } = await supabase.rpc("create_apprenant_from_json", {
        p_item: payloadForRpc,
      });

      if (insErr || !inserted?.id) {
        const msg = insErr ? errorToMessage(insErr) : "Erreur création apprenant";
        if (/row-level security/i.test(msg)) {
          setError("Création refusée (RLS). Ton utilisateur n'a pas le droit d'insérer dans cette org.");
        } else {
          setError(msg);
        }
        return;
      }

      const apprenantId = inserted.id as string;

      if (competences.length > 0) {
        const rowsToInsert = competences.map((c) => ({
          org_id: orgId,
          apprenant_id: apprenantId,
          competence_id: c.id,
          validated: compChecks[c.id] === true,
        }));
        const { error: e } = await supabase.from("apprenant_competences").insert(rowsToInsert);
        if (e) setError(errorToMessage(e));
      }

      if (selectedSessionIds.length > 0) {
        const links = selectedSessionIds.map((sessionId) => ({
          org_id: orgId,
          apprenant_id: apprenantId,
          session_id: sessionId,
        }));
        const { error: e } = await supabase.from("apprenant_sessions").insert(links);
        if (e) setError(errorToMessage(e));
      }

      setOpenCreate(false);
      await loadRows();
      await loadProductStats();
    } catch (e: any) {
      setError(errorToMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveMultiCreate = async () => {
    if (multiSaving) return;

    setMultiError(null);
    setMultiSaving(true);

    try {
      const sessionId = multiCtx?.session_id || selectedSessionIds[0] || searchParams.get("session_id") || "";

      if (!sessionId) {
        setMultiError("Sélectionne au moins 1 session dans “Sessions liées”.");
        return;
      }

      const { data: sessMeta, error: sessErr } = await supabase
        .from("sessions")
        .select(
          "id, org_id, product_id, client_id, start_date, end_date, location_structure, location_street, location_postal_code, location_city"
        )
        .eq("id", sessionId)
        .maybeSingle();

      const orgId = (sessMeta as any)?.org_id as string | undefined;
      if (sessErr || !orgId) {
        setMultiError(sessErr?.message ?? "Organisation introuvable (sessions.org_id).");
        return;
      }

      const cleanRows = (multiRows ?? [])
        .map((r) => ({
          key: r.key,
          last_name: String(r.last_name ?? "").trim(),
          first_name: String(r.first_name ?? "").trim(),
          birth_date: r.birth_date ?? null,
          email: String(r.email ?? "").trim() || null,
        }))
        .filter((r) => r.last_name.length > 0 || r.first_name.length > 0);

      if (cleanRows.length === 0) {
        setMultiError("Ajoute au moins 1 apprenant (nom/prénom).");
        return;
      }

      const createdIds: string[] = [];

      for (const r of cleanRows) {
        const payloadForRpc = {
          last_name: r.last_name,
          first_name: r.first_name,
          birth_date: r.birth_date,
          email: r.email,
          product_id: form.product_id ?? (sessMeta as any)?.product_id ?? null,
          client_id: form.client_id ?? (sessMeta as any)?.client_id ?? null,
          structure: form.structure?.trim() || (sessMeta as any)?.location_structure || null,
          start_date: form.start_date ?? (sessMeta as any)?.start_date ?? null,
          end_date: form.end_date ?? (sessMeta as any)?.end_date ?? null,
          street: form.street?.trim() || (sessMeta as any)?.location_street || null,
          postal_code: form.postal_code?.trim() || (sessMeta as any)?.location_postal_code || null,
          city: form.city?.trim() || (sessMeta as any)?.location_city || null,
          forprev: form.forprev ?? null,
          candidate_manual_validated: false,
        };

        const { data: inserted, error: insErr } = await supabase.rpc("create_apprenant_from_json", {
          p_item: payloadForRpc,
        });

        if (insErr || !inserted?.id) {
          throw new Error(insErr ? errorToMessage(insErr) : "Erreur création apprenant");
        }

        const apprenantId = inserted.id as string;
        createdIds.push(apprenantId);
      }

      if (createdIds.length !== cleanRows.length) {
        setMultiError("Création apprenants incomplète (ids manquants).");
        return;
      }

      const { error: linkErr } = await supabase.from("apprenant_sessions").insert(
        createdIds.map((apprenantId) => ({
          org_id: orgId,
          apprenant_id: apprenantId,
          session_id: sessionId,
        }))
      );

      if (linkErr) {
        const msg = String((linkErr as any)?.message || "");
        if (!/duplicate key value|already exists|conflict/i.test(msg)) {
          setMultiError(errorToMessage(linkErr));
          return;
        }
      }

      setOpenMulti(false);
      setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
      setSelectedSessionIds([]);
      setMultiCtx(null);

      await loadRows();
      await loadProductStats();
    } catch (e: any) {
      setMultiError(e?.message ?? String(e));
    } finally {
      setMultiSaving(false);
    }
  };
    const saveEdit = async () => {
    if (!selectedId) return;
    if (!required(form.last_name) || !required(form.first_name)) return;

    setError(null);
    setSaving(true);

    try {
      const orgId = await getOrgId();
      if (!orgId) return;

      const ok = await ensureOrgContext(orgId);
      if (!ok) {
        setError("Contexte org non défini");
        return;
      }

      const payload = {
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        birth_date: form.birth_date || null,
        email: form.email?.trim() || null,
        product_id: form.product_id,
        client_id: form.client_id,
        structure: form.structure?.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        street: form.street?.trim() || null,
        postal_code: form.postal_code?.trim() || null,
        city: form.city?.trim() || null,
        forprev: form.forprev,
        candidate_manual_validated: !!form.candidate_manual_validated,
      };

      const { data, error } = await supabase
        .from("apprenants")
        .update(payload)
        .eq("id", selectedId)
        .select("id")
        .maybeSingle();

      if (error) {
        setError(errorToMessage(error));
        return;
      }

      if (!data?.id) {
        setError("UPDATE non appliqué (0 ligne). RLS / org mismatch.");
        return;
      }

      await supabase.from("apprenant_competences").delete().eq("apprenant_id", selectedId);

      if (competences.length > 0) {
        const rowsToInsert = competences.map((c) => ({
          org_id: orgId,
          apprenant_id: selectedId,
          competence_id: c.id,
          validated: compChecks[c.id] === true,
        }));
        await supabase.from("apprenant_competences").insert(rowsToInsert);
      }

      await supabase.from("apprenant_sessions").delete().eq("apprenant_id", selectedId);

      if (selectedSessionIds.length > 0) {
        const links = selectedSessionIds.map((sessionId) => ({
          org_id: orgId,
          apprenant_id: selectedId,
          session_id: sessionId,
        }));
        await supabase.from("apprenant_sessions").insert(links);
      }

      setOpenEdit(false);
      await loadRows();
      await loadProductStats();
    } finally {
      setSaving(false);
    }
  };

  const updateMultiRow = (idx: number, patch: Partial<MultiRow>) => {
    setMultiRows((prev) => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addMultiRow = () => {
    setMultiRows((prev) => [...prev, { ...EMPTY_MULTI_ROW, key: makeKey() }]);
  };

  const removeMultiRow = (idx: number) => {
    setMultiRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const clearMultiRows = () => {
    setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
  };

  async function deleteRow(id: string) {
    const ok = window.confirm("Supprimer cet apprenant ?");
    if (!ok) return;

    setDeletingId(id);
    setError(null);

    hideId(id);
    setRows((prev) => prev.filter((r) => r.id !== id));

    const rollback = (msg: string) => {
      setError(msg);
      unhideId(id);
      void loadRows();
      setDeletingId(null);
    };

    const { error: delErr } = await supabase.rpc("delete_apprenant_force", { p_apprenant_id: id });

    if (delErr) {
      rollback(errorToMessage(delErr));
      return;
    }

    await loadRows();
    await loadProductStats();
    setDeletingId(null);
  }

  const toggleForprev = async (id: string, current: boolean | null) => {
    const next = current === null ? true : current === true ? false : null;

    const prevRows = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, forprev: next } : r)));
    setError(null);

    const rollback = (msg: string) => {
      setRows(prevRows);
      setError(msg);
    };

    const orgId = await getOrgId();
    if (!orgId) {
      rollback("Org active introuvable");
      return;
    }

    const ok = await ensureOrgContext(orgId);
    if (!ok) {
      rollback("Contexte org non défini (set_current_org)");
      return;
    }

    const { data, error } = await supabase
      .from("apprenants")
      .update({ forprev: next })
      .eq("id", id)
      .select("id, forprev")
      .maybeSingle();

    if (error) {
      rollback(errorToMessage(error));
      return;
    }

    if (!data?.id) {
      rollback("FORPREV: update non appliqué (0 ligne). RLS / org context / row org_id mismatch.");
      return;
    }

    await loadRows();
    await loadProductStats();
  };

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1 text-sm font-semibold text-muted-foreground">{children}</div>
  );

  const IdentityFields = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Nom</Label>
        <Input value={form.last_name} onChange={(e) => onChange("last_name", e.target.value)} />
      </div>
      <div>
        <Label>Prénom</Label>
        <Input value={form.first_name} onChange={(e) => onChange("first_name", e.target.value)} />
      </div>
      <div>
        <Label>Date de naissance</Label>
        <Input type="date" value={form.birth_date ?? ""} onChange={(e) => onChange("birth_date", e.target.value || null)} />
      </div>
      <div>
        <Label>Email</Label>
        <Input value={form.email ?? ""} onChange={(e) => onChange("email", e.target.value || null)} />
      </div>
      <div className="col-span-2 my-2 h-px bg-border" />
    </div>
  );

  const CommonFields = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Formation (produit)</Label>
        <Select value={form.product_id ?? ""} onChange={(e) => onChange("product_id", e.target.value || null)}>
          <option value="">—</option>
          {produits.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Client</Label>
        <Select value={form.client_id ?? ""} onChange={(e) => onChange("client_id", e.target.value || null)}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Structure</Label>
        <Input value={form.structure ?? ""} onChange={(e) => onChange("structure", e.target.value || null)} />
      </div>

      <div>
        <Label>FORPREV</Label>
        <div className="mt-2">
          <ForprevPill value={form.forprev} onChange={(next) => onChange("forprev", next)} />
        </div>
      </div>

      <div>
        <Label>Début formation</Label>
        <Input type="date" value={form.start_date ?? ""} onChange={(e) => onChange("start_date", e.target.value || null)} />
      </div>

      <div>
        <Label>Fin formation</Label>
        <Input type="date" value={form.end_date ?? ""} onChange={(e) => onChange("end_date", e.target.value || null)} />
      </div>

      <div className="col-span-2">
        <Label>Date de certification (auto)</Label>
        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm font-semibold">{certifAutoLabel}</div>
      </div>

      <div className="col-span-2">
        <div className="mb-2 text-sm font-semibold">Sessions liées</div>

        {!form.end_date ? (
          <div className="text-sm text-muted-foreground">
            Renseigne la <b>date de fin</b> pour afficher les sessions correspondantes.
          </div>
        ) : sessionsLoading ? (
          <div className="text-sm text-muted-foreground">Chargement des sessions…</div>
        ) : sessionsError ? (
          <div className="text-sm text-red-600">{sessionsError}</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune session ne se termine le {certifAutoLabel}.</div>
        ) : (
          <div className="grid gap-2">
            {sessions
              .filter((s) => s && s.id)
              .map((s) => {
                const checked = selectedSessionIds.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {toFrDate(s.start_date)} → {toFrDate(s.end_date)}
                      </div>
                      {s.product?.name ? (
                        <div className="mt-1 text-xs font-semibold text-muted-foreground">Produit: {s.product.name}</div>
                      ) : null}
                    </div>

                    <input
                      type={openMulti ? "radio" : "checkbox"}
                      name={openMulti ? "multi-session" : undefined}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          applySessionToForm(s.id);
                        } else {
                          setSelectedSessionIds((prev) => prev.filter((x) => x !== s.id));
                        }
                      }}
                    />
                  </label>
                );
              })}
          </div>
        )}
      </div>

      <div className="col-span-2 my-2 h-px bg-border" />

      <div className="col-span-2 text-sm font-semibold">Lieu de formation</div>

      <div>
        <Label>Rue</Label>
        <Input value={form.street ?? ""} onChange={(e) => onChange("street", e.target.value || null)} />
      </div>

      <div>
        <Label>Code postal</Label>
        <Input value={form.postal_code ?? ""} onChange={(e) => onChange("postal_code", e.target.value || null)} />
      </div>

      <div>
        <Label>Ville</Label>
        <Input value={form.city ?? ""} onChange={(e) => onChange("city", e.target.value || null)} />
      </div>

      <div />

      <div className="col-span-2 my-2 h-px bg-border" />

      <div className="col-span-2">
        <div className="mb-2 text-sm font-semibold">Compétences (depuis la formation)</div>

        {competences.length > 0 ? (
          <div className="grid gap-2">
            {competences.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3">
                <div className="font-medium">{c.label}</div>
                <input
                  type="checkbox"
                  checked={compChecks[c.id] === true}
                  onChange={(e) =>
                    setCompChecks((prev) => ({
                      ...prev,
                      [c.id]: e.target.checked,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Aucune compétence associée à cette formation. 👉 Validation manuelle possible ci-dessous.
          </div>
        )}
      </div>

      <div className="col-span-2">
        <div className="mb-2 text-sm font-semibold">Candidat validé</div>

        {competences.length > 0 ? (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm font-semibold">
            Validation automatique : {candidateComputed ? "Oui" : "Non"}
            <div className="mt-1 text-xs text-muted-foreground">(toutes les compétences doivent être validées)</div>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={form.candidate_manual_validated}
              onChange={(e) => onChange("candidate_manual_validated", e.target.checked)}
            />
            Valider manuellement le candidat
          </label>
        )}
      </div>
    </div>
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matchesQuery = (r: ApprenantViewRow) => {
      if (!q) return true;
      const blob = [
        r.last_name,
        r.first_name,
        r.client_name ?? "",
        r.session_label ?? "",
        r.formations ?? "",
        r.street ?? "",
        r.postal_code ?? "",
        r.city ?? "",
        r.formation_objectives ?? "",
        String(r.formation_hours_total ?? ""),
        toFrDate(r.end_date),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    };

    const matchesValidated = (r: ApprenantViewRow) => {
      if (filterValidated === "all") return true;
      return filterValidated === "yes" ? isValidatedRow(r) : !isValidatedRow(r);
    };

    const matchesForprev = (r: ApprenantViewRow) => {
      if (filterForprev === "all") return true;
      if (filterForprev === "yes") return r.forprev === true;
      if (filterForprev === "no") return r.forprev === false;
      return r.forprev === null;
    };

    return rows.filter((r) => matchesQuery(r) && matchesValidated(r) && matchesForprev(r));
  }, [rows, query, filterValidated, filterForprev]);

  const sortedRows = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;

    const getVal = (r: ApprenantViewRow) => {
      switch (sort.key) {
        case "last_name":
          return (r.last_name ?? "").toLowerCase();
        case "first_name":
          return (r.first_name ?? "").toLowerCase();
        case "client":
          return (r.client_name ?? "").toLowerCase();
        case "session":
          return (r.session_label ?? "").toLowerCase();
        case "formation":
          return (r.formations ?? "").toLowerCase();
        case "address":
          return `${r.street ?? ""} ${r.postal_code ?? ""} ${r.city ?? ""}`.toLowerCase();
        case "duration_h":
          return typeof r.formation_hours_total === "number" ? r.formation_hours_total : -1;
        case "duration_d":
          return -1;
        case "objectives":
          return (r.formation_objectives ?? "").toLowerCase();
        case "end_date":
          return r.end_date ? new Date(r.end_date).getTime() : 0;
        case "validated":
          return isValidatedRow(r) ? 1 : 0;
        case "forprev":
          return r.forprev === true ? 2 : r.forprev === false ? 1 : 0;
        default:
          return 0;
      }
    };

    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const va = getVal(a) as any;
      const vb = getVal(b) as any;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filteredRows, sort]);

  const AnyOpen = openCreate || openEdit || openView || openMulti;
  const Mode: "create" | "edit" | "view" | "multi" = openMulti ? "multi" : openEdit ? "edit" : openView ? "view" : "create";

  const closeAll = () => {
    setOpenCreate(false);
    setOpenEdit(false);
    setOpenView(false);
    setOpenMulti(false);
  };

  const selectedSessionIdsView = useMemo(
    () => (selected?.apprenant_sessions ?? []).map((x) => x.session_id).filter(Boolean),
    [selected]
  );

  const selectedSessionsLabel = useMemo(() => {
    if (!selectedSessionIdsView.length) return "—";
    const row = selectedId ? rows.find((r) => r.id === selectedId) : null;
    return row?.session_label ?? `${selectedSessionIdsView.length} sessions`;
  }, [rows, selectedId, selectedSessionIdsView]);

  const selectedFormationsLabel = useMemo(() => {
    const row = selectedId ? rows.find((r) => r.id === selectedId) : null;
    return row?.formations?.trim() ? row.formations : "—";
  }, [rows, selectedId]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black tracking-tight">Apprenants</h1>
          <div className="mt-2 text-lg font-semibold text-muted-foreground">Suivi et gestion des candidats</div>
        </div>

        <div className="flex items-center gap-3">
          <SoftButton type="button" onClick={() => void loadRows()} disabled={loading}>
            Rafraîchir
          </SoftButton>

          {!isGuestUser && (
            <>
              <SoftButton type="button" onClick={openMultiModal}>
                + Ajout multiple
              </SoftButton>
              <PrimaryButton type="button" onClick={openCreateModal}>
                + Nouvel apprenant
              </PrimaryButton>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title={`Apprenants ${kpi.nowYear}`}
          value={`${kpi.totalNow}`}
          subline={`Validés : ${kpi.validatedNow}`}
          prevline={`${kpi.prevYear} : ${kpi.totalPrev}`}
          tone="blue"
          icon="👤"
        />
        <StatCard
          title={`Validés ${kpi.nowYear}`}
          value={`${kpi.validatedNow}`}
          subline={`Taux : ${kpi.rateNow}%`}
          prevline={`${kpi.prevYear} : ${kpi.validatedPrev} (Taux: ${kpi.ratePrev}%)`}
          tone="green"
          icon="🎓"
        />
        <StatCard
          title={`Taux ${kpi.nowYear}`}
          value={`${kpi.rateNow}%`}
          subline={`Total : ${kpi.totalNow}`}
          prevline={`${kpi.prevYear} : ${kpi.ratePrev}%`}
          tone="orange"
          icon="📈"
        />
        <StatCard
          title={`FORPREV "Non" ${kpi.nowYear}`}
          value={`${kpi.forprevNoNow}`}
          subline={`Sur ${kpi.totalNow} apprenants`}
          prevline={`${kpi.prevYear} : ${kpi.forprevNoPrev}`}
          tone="red"
          icon="⚑"
        />
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">Taux de réussite par formation</div>
          <div className="text-xs text-muted-foreground">{productStatsLoading ? "Chargement…" : `${productStats.length}`}</div>
        </div>

        {productStatsLoading ? (
          <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Chargement…</div>
        ) : productStats.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Aucune formation avec des apprenants.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {productStats.map((s) => {
              const neutral = s.total === 0;
              const good = s.total > 0 && s.rate >= 80;
              const valueClass = neutral ? "text-muted-foreground" : good ? "text-green-600" : "text-red-600";

              return (
                <div key={s.product_id} className="min-w-[160px] flex-0 rounded-2xl border bg-white px-4 py-3 text-center">
                  <div className="truncate text-[11px] font-bold text-muted-foreground">{s.product_name}</div>
                  <div className={`mt-2 text-3xl font-black ${valueClass}`}>{neutral ? "0%" : `${s.rate}%`}</div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">
                    {s.validated}/{s.total}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <div className="font-semibold">Erreur</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      )}

      <div className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between gap-4 px-6 pt-6">
          <div className="text-2xl font-bold">Liste des apprenants</div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <details className="group">
                <summary className="cursor-pointer select-none rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted/20">
                  ⚙ Colonnes
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border bg-white p-3 shadow-xl">
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">Afficher colonnes</div>
                  {ALL_COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={visibleCols[c.key]}
                        onChange={(e) =>
                          setVisibleCols((p) => ({
                            ...p,
                            [c.key]: e.target.checked,
                          }))
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <SoftButton type="button" onClick={() => void loadRows()} disabled={loading}>
              Rafraîchir
            </SoftButton>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 px-6 pb-6 pt-4">
          <div className="col-span-8">
            <Input placeholder="Rechercher un apprenant…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Select value={filterValidated} onChange={(e) => setFilterValidated(e.target.value as any)}>
              <option value="all">Tous</option>
              <option value="yes">Validés</option>
              <option value="no">Non validés</option>
            </Select>
          </div>

          <div className="col-span-2">
            <Select value={filterForprev} onChange={(e) => setFilterForprev(e.target.value as any)}>
              <option value="all">FORPREV (tous)</option>
              <option value="yes">FORPREV : Oui</option>
              <option value="no">FORPREV : Non</option>
              <option value="nc">FORPREV : n.c</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="px-6 pb-6">
            <div className="rounded-2xl border p-6 text-muted-foreground">Chargement…</div>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="px-6 pb-6">
            <div className="rounded-2xl border p-6 text-muted-foreground">Aucun apprenant</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-2xl border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {visibleColumns.map((col) => {
                    const isSorted = sort.key === col.key;
                    const arrow = isSorted ? (sort.dir === "asc" ? "▲" : "▼") : "";
                    return (
                      <th
                        key={col.key}
                        className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold text-muted-foreground"
                        onClick={() => toggleSort(col.key)}
                        title="Trier"
                      >
                        <span className="inline-flex items-center gap-2">
                          {col.label} <span className="text-[10px]">{arrow}</span>
                        </span>
                      </th>
                    );
                  })}
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[12px] font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((r, idx) => (
                  <tr key={r.id} className={`border-t leading-tight hover:bg-muted/20 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                    {visibleColumns.map((col) => {
                      let value: React.ReactNode = (r as any)[col.key];

                      if (col.key === "last_name") value = <span className="font-semibold">{r.last_name ?? "—"}</span>;
                      if (col.key === "first_name") value = r.first_name ?? "—";
                      if (col.key === "client") value = r.client_name ?? "—";
                      if (col.key === "session") value = r.session_label ?? "—";
                      if (col.key === "formation") value = (r.formations ?? "").trim() ? r.formations : "—";
                      if (col.key === "address") {
                        const addr = [r.street ?? "", r.postal_code ?? "", r.city ?? ""].filter(Boolean).join(" ").trim();
                        value = addr || "—";
                      }
                      if (col.key === "duration_h") value = typeof r.formation_hours_total === "number" ? r.formation_hours_total : "—";
                      if (col.key === "duration_d") value = "—";
                      if (col.key === "objectives") {
                        const o = (r.formation_objectives ?? "").trim();
                        value = o ? (
                          <span className="inline-block max-w-[520px] truncate align-bottom" title={o}>
                            {o}
                          </span>
                        ) : (
                          "—"
                        );
                      }
                      if (col.key === "end_date") value = toFrDate(r.end_date);
                      if (col.key === "validated") value = yesNo(isValidatedRow(r));
                      if (col.key === "forprev") {
                        value = <ForprevPill value={r.forprev} onChange={() => void toggleForprev(r.id, r.forprev)} size="sm" />;
                      }

                      return (
                        <td key={col.key} className="whitespace-nowrap px-3 py-2 text-[13px]">
                          {value}
                        </td>
                      );
                    })}

                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void openViewModal(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-base shadow-sm hover:bg-muted/20"
                          title="Visualiser"
                        >
                          👁️
                        </button>

                        <button
                          type="button"
                          onClick={() => void openEditModal(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-base shadow-sm hover:bg-muted/20"
                          title="Modifier"
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => void deleteRow(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-base shadow-sm hover:bg-muted/20 disabled:opacity-50"
                          title="Supprimer"
                        >
                          {deletingId === r.id ? "…" : "🗑️"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void downloadAttestation(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-base shadow-sm hover:bg-muted/20"
                          title="Générer attestation"
                        >
                          📄
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-6 py-4 text-sm text-muted-foreground">
              {sortedRows.length} / {rows.length}
            </div>
          </div>
        )}
      </div>

      {AnyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4" onMouseDown={() => closeAll()}>
          <div
            className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <div className="text-xl font-semibold">{modalTitle(Mode)}</div>
                {Mode === "multi" ? (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Infos communes préremplies depuis la session – Nom / Prénom propres à chaque apprenant
                  </div>
                ) : null}
              </div>

              <SoftButton onClick={() => closeAll()} type="button">
                Fermer
              </SoftButton>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {Mode === "view" && selected && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Nom</div>
                      <div className="mt-1 font-semibold">{selected.last_name ?? "—"}</div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Prénom</div>
                      <div className="mt-1 font-semibold">{selected.first_name ?? "—"}</div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div className="mt-1 font-semibold">{selected.email ?? "—"}</div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Date de naissance</div>
                      <div className="mt-1 font-semibold">{toFrDate(selected.birth_date)}</div>
                    </div>

                    <div className="col-span-2 rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Structure</div>
                      <div className="mt-1 font-semibold">{selected.structure ?? "—"}</div>
                    </div>

                    <div className="col-span-2 rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Adresse</div>
                      <div className="mt-1 font-semibold">
                        {[selected.street ?? "", selected.postal_code ?? "", selected.city ?? ""].filter(Boolean).join(" ").trim() || "—"}
                      </div>
                    </div>

                    <div className="col-span-2 rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Sessions</div>
                      <div className="mt-1 font-semibold">{selectedSessionsLabel}</div>
                    </div>

                    <div className="col-span-2 rounded-xl border p-4">
                      <div className="text-xs text-muted-foreground">Formations</div>
                      <div className="mt-1 font-semibold">{selectedFormationsLabel}</div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <SoftButton type="button" onClick={closeAll}>
                      Fermer
                    </SoftButton>
                    <PrimaryButton
                      type="button"
                      onClick={() => {
                        closeAll();
                        void openEditModal(selected.id);
                      }}
                    >
                      Modifier
                    </PrimaryButton>
                  </div>
                </div>
              )}

              {(Mode === "create" || Mode === "edit" || Mode === "multi") && (
                <div className="space-y-6">
                  {Mode === "create" || Mode === "edit" ? IdentityFields : null}

                  {CommonFields}

                  {Mode === "multi" && (
                    <div className="rounded-2xl border p-4">
                      <div className="mb-2 text-sm font-bold">Apprenants (Nom / Prénom / Date de naissance / Email par ligne)</div>

                      {multiError && <div className="mb-2 text-sm text-red-600">{multiError}</div>}

                      <div className="grid gap-3">
                        {multiRows.map((r, idx) => (
                          <div key={r.key} className="rounded-xl border p-3">
                            <div className="grid grid-cols-12 items-end gap-2">
                              <div className="col-span-12 md:col-span-3">
                                <Label>Nom</Label>
                                <Input value={r.last_name} onChange={(e) => updateMultiRow(idx, { last_name: e.target.value })} />
                              </div>

                              <div className="col-span-12 md:col-span-3">
                                <Label>Prénom</Label>
                                <Input value={r.first_name} onChange={(e) => updateMultiRow(idx, { first_name: e.target.value })} />
                              </div>

                              <div className="col-span-12 md:col-span-2">
                                <Label>Date de naissance</Label>
                                <Input
                                  type="date"
                                  value={r.birth_date ?? ""}
                                  onChange={(e) => updateMultiRow(idx, { birth_date: e.target.value || null })}
                                />
                              </div>

                              <div className="col-span-12 md:col-span-3">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={r.email ?? ""}
                                  onChange={(e) => updateMultiRow(idx, { email: e.target.value || null })}
                                />
                              </div>

                              <div className="col-span-12 md:col-span-1 flex justify-end gap-2">
                                <SoftButton type="button" onClick={addMultiRow}>
                                  +
                                </SoftButton>
                                <SoftButton type="button" onClick={() => removeMultiRow(idx)} disabled={multiRows.length <= 1}>
                                  −
                                </SoftButton>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex justify-between">
                        <SoftButton type="button" onClick={clearMultiRows}>
                          Vider
                        </SoftButton>

                        <PrimaryButton type="button" disabled={multiSaving} onClick={() => void saveMultiCreate()}>
                          {multiSaving ? "Création…" : "Créer + Lier à la session"}
                        </PrimaryButton>
                      </div>
                    </div>
                  )}

                  {Mode === "create" && (
                    <div className="flex justify-end gap-2">
                      <SoftButton type="button" onClick={closeAll}>
                        Annuler
                      </SoftButton>
                      <PrimaryButton type="button" disabled={saving} onClick={() => void saveCreate()}>
                        {saving ? "Enregistrement…" : "Créer"}
                      </PrimaryButton>
                    </div>
                  )}

                  {Mode === "edit" && (
                    <div className="flex justify-end gap-2">
                      <SoftButton type="button" onClick={closeAll}>
                        Annuler
                      </SoftButton>
                      <PrimaryButton type="button" disabled={saving} onClick={() => void saveEdit()}>
                        {saving ? "Enregistrement…" : "Enregistrer"}
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              )}

              {Mode === "view" && !selected ? (
                <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Aucune donnée à afficher.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}