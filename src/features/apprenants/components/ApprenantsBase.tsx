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

  client_name?: string | null;
  session_label?: string | null;
};

type Client = { id: string; name: string };
type Produit = { id: string; name: string };
type Competence = { id: string; label: string };

type Session = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
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

  forprev: boolean | null; // ✅ tri-état
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

type ColKey = "last_name" | "first_name" | "client" | "session" | "end_date" | "validated" | "forprev";
type SortState = { key: ColKey; dir: "asc" | "desc" };

/* ================== HELPERS ================== */

function errorToMessage(err: any): string {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;
  if (err?.message) return err.message;
  if (err?.error_description) return err.error_description;
  if (err?.details) return err.details;
  if (err?.hint) return err.hint;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
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
    if (cur === null) return true;   // N.C -> Oui
    if (cur === true) return false;  // Oui -> Non
    return null;                     // Non -> N.C
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

const STORAGE_KEY = "apprenants_table_columns_v3";

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: "last_name", label: "Nom" },
  { key: "first_name", label: "Prénom" },
  { key: "client", label: "Client" },
  { key: "session", label: "Session" },
  { key: "end_date", label: "Certification" },
  { key: "validated", label: "Validé" },
  { key: "forprev", label: "FORPREV" },
];

export default function ApprenantsPageClient() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApprenantViewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // si la fonction n'existe pas -> on ignore
  if (e && /function .*set_current_org/i.test(e.message)) return true;

  // si c'est forbidden (RLS/permissions) -> on ignore aussi (on ne bloque pas l'app)
  if (e && /forbidden|permission|not allowed|not authorized|403/i.test(e.message)) return true;

  // autres erreurs -> on affiche, mais on ne throw pas (sinon crash)
  if (e) {
    setError(`Contexte org: ${errorToMessage(e)}`);
    return false;
  }

  return true;
};

  const getOrgId = async () => {
    const { data: orgId, error: e } = await supabase.rpc("current_org_id");
    if (e || !orgId) {
      setError(e ? errorToMessage(e) : "Org active introuvable");
      return null;
    }
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
    const ids = baseRows.map((r) => r.id);

    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: apprData, error: apprErr } = await supabase.from("apprenants").select("id, client_id").in("id", ids);
    if (apprErr) {
      setError(errorToMessage(apprErr));
      setRows(baseRows);
      setLoading(false);
      return;
    }

    const clientIds = Array.from(new Set((apprData ?? []).map((a: any) => a.client_id).filter(Boolean)));
    const clientNameById = new Map<string, string>();

    if (clientIds.length > 0) {
      const { data: cData, error: cErr } = await supabase.from("clients").select("id,name").in("id", clientIds);
      if (cErr) setError(errorToMessage(cErr));
      (cData ?? []).forEach((c: any) => clientNameById.set(c.id, c.name ?? "—"));
    }

    const clientNameByAppr = new Map<string, string | null>();
    (apprData ?? []).forEach((a: any) => {
      const cid = a.client_id as string | null;
      clientNameByAppr.set(a.id, cid ? clientNameById.get(cid) ?? null : null);
    });

    const { data: piv, error: pivErr } = await supabase
      .from("apprenant_sessions")
      .select("apprenant_id, session_id")
      .in("apprenant_id", ids);

    if (pivErr) {
      setError(errorToMessage(pivErr));
      setRows(
        baseRows.map((r) => ({
          ...r,
          client_name: clientNameByAppr.get(r.id) ?? null,
          session_label: null,
        }))
      );
      setLoading(false);
      return;
    }

    const sessionIds = Array.from(new Set((piv ?? []).map((x: any) => x.session_id)));
    const sessionNameById = new Map<string, string>();

    if (sessionIds.length > 0) {
      const { data: sData, error: sErr } = await supabase.from("sessions").select("id,name").in("id", sessionIds);
      if (sErr) setError(errorToMessage(sErr));
      (sData ?? []).forEach((s: any) => sessionNameById.set(s.id, s.name ?? "—"));
    }

    const sessionsByAppr = new Map<string, string[]>();
    (piv ?? []).forEach((x: any) => {
      const aid = x.apprenant_id as string;
      const sid = x.session_id as string;
      const name = sessionNameById.get(sid) ?? "—";
      const arr = sessionsByAppr.get(aid) ?? [];
      arr.push(name);
      sessionsByAppr.set(aid, arr);
    });

    const enriched = baseRows.map((r) => {
      const sessNames = sessionsByAppr.get(r.id) ?? [];
      const session_label = sessNames.length === 0 ? null : sessNames.length === 1 ? sessNames[0] : `${sessNames.length} sessions`;

      return {
        ...r,
        client_name: clientNameByAppr.get(r.id) ?? null,
        session_label,
      };
    });

    setRows(enriched);
    setLoading(false);
  };

  const loadProductStats = async () => {
    setProductStatsLoading(true);
    setError(null);

    const orgId = await getOrgId();
    if (!orgId) {
      setProductStats([]);
      setProductStatsLoading(false);
      return;
    }

    const { data, error: e1 } = await supabase
      .from("apprenants")
      .select("id,org_id,product_id,candidate_manual_validated")
      .eq("org_id", orgId);

    if (e1) {
      setError(errorToMessage(e1));
      setProductStats([]);
      setProductStatsLoading(false);
      return;
    }

    const apprIds = (data ?? []).map((a: any) => a.id);

    const { data: pivData, error: pivErr } = await supabase
      .from("apprenant_competences")
      .select("apprenant_id, validated")
      .in("apprenant_id", apprIds.length ? apprIds : ["00000000-0000-0000-0000-000000000000"]);

    if (pivErr) {
      setError(errorToMessage(pivErr));
      setProductStats([]);
      setProductStatsLoading(false);
      return;
    }

    const compsByAppr = new Map<string, boolean[]>();
    (pivData ?? []).forEach((r: any) => {
      const arr = compsByAppr.get(r.apprenant_id) ?? [];
      arr.push(r.validated === true);
      compsByAppr.set(r.apprenant_id, arr);
    });

    const prodNameById = new Map<string, string>();
    produits.forEach((p) => prodNameById.set(p.id, p.name));

    const map = new Map<string, { name: string; total: number; validated: number }>();

    (data ?? []).forEach((a: any) => {
      const pid = a.product_id as string | null;
      if (!pid) return;

      const name = prodNameById.get(pid) ?? "Sans nom";
      const comps = compsByAppr.get(a.id) ?? [];
      const hasComps = comps.length > 0;
      const isValidated = hasComps ? comps.every(Boolean) : a.candidate_manual_validated === true;

      const prev = map.get(pid) ?? { name, total: 0, validated: 0 };
      prev.total += 1;
      if (isValidated) prev.validated += 1;
      prev.name = name;
      map.set(pid, prev);
    });

    produits.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, { name: p.name, total: 0, validated: 0 });
    });

    const stats: ProductStat[] = Array.from(map.entries()).map(([product_id, v]) => ({
      product_id,
      product_name: v.name,
      total: v.total,
      validated: v.validated,
      rate: v.total > 0 ? Math.round((v.validated / v.total) * 100) : 0,
    }));

    stats.sort((a, b) => a.product_name.localeCompare(b.product_name));
    setProductStats(stats);
    setProductStatsLoading(false);
  };

  const loadCompetencesForProduct = async (productId: string | null, seedChecks?: Record<string, boolean>) => {
    if (!productId) {
      setCompetences([]);
      setCompChecks({});
      return;
    }

    const { data, error: e } = await supabase.from("competences").select("id,label").eq("product_id", productId).order("label");

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

    if (comps.length > 0) setForm((p) => ({ ...p, candidate_manual_validated: false }));
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

      const { data, error: e } = await supabase
        .from("sessions")
        .select("id,name,start_date,end_date")
        .eq("org_id", orgId)
        .eq("end_date", endDate)
        .order("start_date", { ascending: false });

      if (e) {
        setSessions([]);
        setSessionsError(errorToMessage(e));
        return;
      }
      setSessions((data ?? []) as Session[]);
    } catch (e: any) {
      setSessions([]);
      setSessionsError(errorToMessage(e));
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadRefs();
      await loadRows();
    })();
  }, []);

  useEffect(() => {
    if (produits.length === 0) return;
    void loadProductStats();
  }, [produits]);

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

    setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
    setMultiError(null);
    setOpenMulti(true);
  };

  useEffect(() => {
    const multi = searchParams.get("multi");
    const sessionId = searchParams.get("session_id");
    if (multi !== "1" || !sessionId) return;

    openMultiModal();

    const product_id = searchParams.get("product_id");
    const client_id = searchParams.get("client_id");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");
    const structure = searchParams.get("structure");

    setForm((p) => ({
      ...p,
      product_id: product_id || null,
      client_id: client_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      structure: structure || p.structure || null,
    }));

    setSelectedSessionIds([sessionId]);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/apprenants");
    }
  }, [searchParams]);

  const openViewModal = async (id: string) => {
    setError(null);
    try {
      const { data, error: e } = await supabase.from("apprenants").select("*").eq("id", id).maybeSingle();
      if (e || !data) {
        setError(e ? errorToMessage(e) : "Erreur chargement apprenant");
        return;
      }
      setSelected(data as ApprenantDb);
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

      const { data: inserted, error: insErr } = await supabase.rpc("create_apprenant_from_json", { p_item: payloadForRpc });

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
    setMultiSaving(true);
    setMultiError(null);

    try {
      const clean = multiRows
        .map((r) => ({
          last_name: r.last_name.trim(),
          first_name: r.first_name.trim(),
          birth_date: r.birth_date || null,
          email: r.email?.trim() || null,
        }))
        .filter((r) => r.last_name.length > 0 || r.first_name.length > 0 || (r.email ?? "").length > 0 || !!r.birth_date);

      const valid = clean.filter((r) => r.last_name.length > 0 && r.first_name.length > 0);
      if (valid.length === 0) {
        setMultiError("Ajoute au moins 1 apprenant avec Nom + Prénom.");
        return;
      }

      const orgId = await getOrgId();
      if (!orgId) return;

      const common = {
        org_id: orgId,

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

      const payloads = valid.map((r) => ({
        ...common,
        last_name: r.last_name,
        first_name: r.first_name,
        birth_date: r.birth_date,
        email: r.email,
      }));

      // ⚠️ IMPORTANT: si create_apprenants_bulk renvoie une erreur (RLS, cast date, uuid, etc),
      // on ne throw PAS, on affiche un message lisible -> pas de Runtime Error [object Object]
      const { data: insertedRows, error: insErr } = await supabase.rpc("create_apprenants_bulk", { p_items: payloads });

      if (insErr) {
        setMultiError(errorToMessage(insErr));
        return;
      }

      const newIds = (insertedRows ?? []).map((x: any) => x.id as string).filter(Boolean);
      if (newIds.length === 0) {
        setMultiError("Aucun apprenant inséré.");
        return;
      }

      if (competences.length > 0) {
        const pivots: any[] = [];
        for (const apprenantId of newIds) {
          for (const c of competences) {
            pivots.push({
              org_id: orgId,
              apprenant_id: apprenantId,
              competence_id: c.id,
              validated: compChecks[c.id] === true,
            });
          }
        }
        const { error: pivErr } = await supabase.from("apprenant_competences").insert(pivots);
        if (pivErr) setError(errorToMessage(pivErr));
      }

      if (selectedSessionIds.length > 0) {
        const links: any[] = [];
        for (const apprenantId of newIds) {
          for (const sessionId of selectedSessionIds) {
            links.push({ org_id: orgId, apprenant_id: apprenantId, session_id: sessionId });
          }
        }
        const { error: linkErr } = await supabase.from("apprenant_sessions").insert(links);
        if (linkErr) setError(errorToMessage(linkErr));
      }

      setOpenMulti(false);
      await loadRows();
      await loadProductStats();
    } catch (e: any) {
      // Catch ultime: on transforme tout en string -> plus de crash React
      setMultiError(errorToMessage(e));
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

      const orgId = await getOrgId();
      if (!orgId) return;

      const { error: updErr } = await supabase.from("apprenants").update(payload).eq("org_id", orgId).eq("id", selectedId);
      if (updErr) {
        setError(errorToMessage(updErr));
        return;
      }

      const { error: delPivotErr } = await supabase
        .from("apprenant_competences")
        .delete()
        .eq("org_id", orgId)
        .eq("apprenant_id", selectedId);

      if (delPivotErr) {
        setError(errorToMessage(delPivotErr));
        return;
      }

      if (competences.length > 0) {
        const rowsToInsert = competences.map((c) => ({
          org_id: orgId,
          apprenant_id: selectedId,
          competence_id: c.id,
          validated: compChecks[c.id] === true,
        }));

        const { error: pivotErr } = await supabase.from("apprenant_competences").insert(rowsToInsert);
        if (pivotErr) {
          setError(errorToMessage(pivotErr));
          return;
        }
      }

      const { error: delLinksErr } = await supabase
        .from("apprenant_sessions")
        .delete()
        .eq("org_id", orgId)
        .eq("apprenant_id", selectedId);

      if (delLinksErr) {
        setError(errorToMessage(delLinksErr));
        return;
      }

      if (selectedSessionIds.length > 0) {
        const links = selectedSessionIds.map((sessionId) => ({
          org_id: orgId,
          apprenant_id: selectedId,
          session_id: sessionId,
        }));

        const { error: insLinksErr } = await supabase.from("apprenant_sessions").insert(links);
        if (insLinksErr) {
          setError(errorToMessage(insLinksErr));
          return;
        }
      }

      setOpenEdit(false);
      await loadRows();
      await loadProductStats();
    } catch (e: any) {
      setError(errorToMessage(e));
    } finally {
      setSaving(false);
    }
  };

  async function deleteRow(id: string) {
    const ok = window.confirm("Supprimer cet apprenant ?");
    if (!ok) return;

    setError(null);

    const { error: e } = await supabase.rpc("delete_apprenant", { p_apprenant_id: id });

    if (e) {
      setError(errorToMessage(e));
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));

    await loadRows();
    await loadProductStats();
  }

  const toggleForprev = async (id: string, current: boolean | null) => {
    const next = current === null ? true : current === true ? false : null;

    setError(null);

    const orgId = await getOrgId();
    if (!orgId) return;

    const { error: e } = await supabase.from("apprenants").update({ forprev: next }).eq("org_id", orgId).eq("id", id);

    if (e) {
      setError(errorToMessage(e));
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, forprev: next } : r)));
    await loadProductStats();
  };

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const addMultiRow = () => setMultiRows((prev) => [...prev, { ...EMPTY_MULTI_ROW, key: makeKey() }]);

  const clearMultiRows = () => {
    setMultiRows([{ ...EMPTY_MULTI_ROW, key: makeKey() }]);
    setMultiError(null);
  };

  const updateMultiRow = (idx: number, patch: Partial<MultiRow>) => {
    setMultiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeMultiRow = (idx: number) => setMultiRows((prev) => prev.filter((_, i) => i !== idx));

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1 text-sm font-semibold text-muted-foreground">{children}</div>
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
        <Input value={form.structure ?? ""} onChange={(e) => onChange("structure", (e.target as HTMLInputElement).value || null)} />
      </div>

      <div>
       <Label>FORPREV</Label>
<div className="mt-2">
  <ForprevPill value={form.forprev} onChange={(next) => onChange("forprev", next)} />
</div>
      </div>

      <div>
        <Label>Début formation</Label>
        <Input type="date" value={form.start_date ?? ""} onChange={(e) => onChange("start_date", (e.target as HTMLInputElement).value || null)} />
      </div>

      <div>
        <Label>Fin formation</Label>
        <Input type="date" value={form.end_date ?? ""} onChange={(e) => onChange("end_date", (e.target as HTMLInputElement).value || null)} />
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
                    </div>

                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...selectedSessionIds, s.id]))
                          : selectedSessionIds.filter((x) => x !== s.id);
                        setSelectedSessionIds(next);
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
        <Input value={form.street ?? ""} onChange={(e) => onChange("street", (e.target as HTMLInputElement).value || null)} />
      </div>

      <div>
        <Label>Code postal</Label>
        <Input value={form.postal_code ?? ""} onChange={(e) => onChange("postal_code", (e.target as HTMLInputElement).value || null)} />
      </div>

      <div>
        <Label>Ville</Label>
        <Input value={form.city ?? ""} onChange={(e) => onChange("city", (e.target as HTMLInputElement).value || null)} />
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
      const blob = [r.last_name, r.first_name, r.client_name ?? "", r.session_label ?? "", toFrDate(r.end_date)]
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

  const LabelView = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );

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
          <SoftButton type="button" onClick={openMultiModal}>
            + Ajout multiple
          </SoftButton>
          <PrimaryButton type="button" onClick={openCreateModal}>
            + Nouvel apprenant
          </PrimaryButton>
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
                  <th className="whitespace-nowrap px-3 py-3 text-right text-[12px] font-semibold text-muted-foreground">Actions</th>
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
                      if (col.key === "end_date") value = toFrDate(r.end_date);
                      if (col.key === "validated") value = yesNo(isValidatedRow(r));
                     if (col.key === "forprev") {
  value = (
    <ForprevPill
      value={r.forprev}
      onChange={() => void toggleForprev(r.id, r.forprev)}
      size="sm"
    />
  );
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
                          onClick={() => void deleteRow(r.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-base shadow-sm hover:bg-muted/20"
                          title="Supprimer"
                        >
                          🗑️
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
                    Infos communes partagées – Nom / Prénom propres à chaque apprenant
                  </div>
                ) : null}
              </div>

              <SoftButton onClick={() => closeAll()} type="button">
                Fermer
              </SoftButton>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {Mode === "view" && selected ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <LabelView label="Nom" value={selected.last_name ?? "—"} />
                    <LabelView label="Prénom" value={selected.first_name ?? "—"} />
                    <LabelView label="Naissance" value={toFrDate(selected.birth_date)} />
                    <LabelView label="Email" value={selected.email ?? "—"} />
                  </div>

                  <div className="flex justify-end gap-3">
                    <SoftButton
                      type="button"
                      onClick={() => {
                        const id = selectedId;
                        setOpenView(false);
                        if (id) void openEditModal(id);
                      }}
                    >
                      Modifier
                    </SoftButton>
                  </div>
                </div>
              ) : Mode === "multi" ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 text-sm font-semibold">Infos communes</div>
                    {CommonFields}
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold">Apprenants</div>
                      <div className="flex gap-2">
                        <SoftButton onClick={addMultiRow} type="button">
                          + Ligne
                        </SoftButton>
                        <SoftButton onClick={clearMultiRows} type="button">
                          Vider
                        </SoftButton>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold text-muted-foreground">Nom</th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                              Prénom
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                              Naissance
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                              Email
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-right text-[12px] font-semibold text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {multiRows.map((r, idx) => (
                            <tr key={r.key} className="border-t">
                              <td className="px-3 py-3">
                                <Input value={r.last_name} onChange={(e) => updateMultiRow(idx, { last_name: (e.target as HTMLInputElement).value })} />
                              </td>
                              <td className="px-3 py-3">
                                <Input value={r.first_name} onChange={(e) => updateMultiRow(idx, { first_name: (e.target as HTMLInputElement).value })} />
                              </td>
                              <td className="px-3 py-3">
                                <Input
                                  type="date"
                                  value={r.birth_date ?? ""}
                                  onChange={(e) => updateMultiRow(idx, { birth_date: (e.target as HTMLInputElement).value || null })}
                                />
                              </td>
                              <td className="px-3 py-3">
                                <Input value={r.email ?? ""} onChange={(e) => updateMultiRow(idx, { email: (e.target as HTMLInputElement).value || null })} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <SoftButton onClick={() => removeMultiRow(idx)} type="button">
                                  Suppr
                                </SoftButton>
                              </td>
                            </tr>
                          ))}
                          {multiRows.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                                Ajoute une ligne
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {multiError && <div className="mt-3 whitespace-pre-wrap text-sm font-semibold text-red-600">{multiError}</div>}
                  </div>

                  <div className="flex justify-end gap-3">
                    <SoftButton type="button" onClick={() => setOpenMulti(false)} disabled={multiSaving}>
                      Annuler
                    </SoftButton>
                    <PrimaryButton type="button" onClick={() => void saveMultiCreate()} disabled={multiSaving}>
                      {multiSaving ? "Enregistrement…" : "Enregistrer tout"}
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nom *</Label>
                        <Input value={form.last_name} onChange={(e) => onChange("last_name", (e.target as HTMLInputElement).value)} />
                      </div>
                      <div>
                        <Label>Prénom *</Label>
                        <Input value={form.first_name} onChange={(e) => onChange("first_name", (e.target as HTMLInputElement).value)} />
                      </div>
                      <div>
                        <Label>Date de naissance</Label>
                        <Input type="date" value={form.birth_date ?? ""} onChange={(e) => onChange("birth_date", (e.target as HTMLInputElement).value || null)} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input value={form.email ?? ""} onChange={(e) => onChange("email", (e.target as HTMLInputElement).value || null)} />
                      </div>
                    </div>

                    <div className="h-px bg-border" />
                    {CommonFields}
                  </div>

                  <div className="flex justify-end gap-3">
                    <SoftButton type="button" onClick={() => closeAll()} disabled={saving}>
                      Annuler
                    </SoftButton>

                    <PrimaryButton
                      type="button"
                      disabled={saving || !required(form.last_name) || !required(form.first_name)}
                      onClick={() => {
                        setError(null);
                        void (Mode === "edit" ? saveEdit() : saveCreate());
                      }}
                    >
                      {saving ? "Enregistrement…" : "Enregistrer"}
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
