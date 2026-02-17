"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissions } from "@/features/auth/PermissionsProviderClient";

/* =========================================================
   Sessions — UI calée sur Factures (propre)
   + Colonnes: popover en haut (pas en bas)
   + Tableau triable par colonne
   + Après création: proposition ajout multiple d'apprenants
   + Sous-traitée => choix d’un formateur indépendant invité
========================================================= */

const SESSIONS_TABLE = "sessions";
const CLIENTS_TABLE = "clients";
const PRODUCTS_TABLE = "products";

type DeliveryType = "direct" | "subcontract" | "sous_traitee";

type ClientRow = { id: string; name: string };
type ProductRow = { id: string; name: string };

type SubcontractorRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  logo_url: string | null;
};

type SessionRow = {
  id: string;
  org_id: string;
  subcontractor_user_id?: string | null;

  product_id: string | null;
  client_id: string | null;

  name: string;
  delivery_type: DeliveryType;

  start_date: string;
  end_date: string;
  certification_date: string | null;

  location_structure: string | null;
  location_street: string | null;
  location_postal_code: string | null;
  location_city: string | null;

  created_at?: string;
  updated_at?: string;

  client_name?: string;
  product_name?: string;
};

type LearnerRow = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  nom?: string | null;
  email?: string | null;
  mail?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  [k: string]: any;
};

/* ================== HELPERS ================== */
const required = (v?: string | null) => !!v && v.trim().length > 0;
const safeLower = (s?: string | null) => (s ?? "").toLowerCase();

const toFrDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
};

function yearOf(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  const y = d.getFullYear();
  return Number.isFinite(y) ? y : null;
}

function daysBetweenInclusive(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1);
}

function statusOfSession(r: SessionRow) {
  const now = new Date();
  const s = new Date(r.start_date);
  const e = new Date(r.end_date);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "UNKNOWN" as const;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate());

  if (ed < today) return "PAST" as const;
  if (sd > today) return "UPCOMING" as const;
  return "ONGOING" as const;
}

function getLearnerName(l: LearnerRow) {
  const ln = typeof l.last_name === "string" ? l.last_name.trim() : "";
  const fn = typeof l.first_name === "string" ? l.first_name.trim() : "";
  if (ln || fn) return `${ln} ${fn}`.trim();

  if (typeof l.name === "string" && l.name.trim()) return l.name.trim();
  if (typeof l.full_name === "string" && l.full_name.trim()) return l.full_name.trim();
  if (typeof l.nom === "string" && l.nom.trim()) return l.nom.trim();

  return "—";
}

function getLearnerEmail(l: LearnerRow) {
  if (typeof l.email === "string" && l.email.trim()) return l.email.trim();
  if (typeof l.mail === "string" && l.mail.trim()) return l.mail.trim();
  return "";
}

/* ================== STYLES ================== */
const containerStyle: React.CSSProperties = { width: "100%", maxWidth: 1200, margin: "0 auto", padding: 18 };
const headerRowStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14, marginTop: 14 };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid rgba(15, 23, 42, 0.10)", borderRadius: 14, boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)" };
const sectionHeaderStyle: React.CSSProperties = { padding: "14px 14px 10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const filtersRowStyle: React.CSSProperties = { padding: "0 14px 12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const searchWrapStyle: React.CSSProperties = { flex: 1, minWidth: 260 };

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  outline: "none",
  fontWeight: 700,
};

const selectStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  outline: "none",
  background: "white",
  fontWeight: 800,
};

const softBtnStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgb(220, 38, 38)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const tableWrapStyle: React.CSSProperties = { width: "100%", overflowX: "auto", borderTop: "1px solid rgba(15, 23, 42, 0.10)" };
const tableStyle: React.CSSProperties = { width: "100%", minWidth: 980, borderCollapse: "separate", borderSpacing: 0 };

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  letterSpacing: 0.2,
  opacity: 0.7,
  fontWeight: 900,
  background: "rgba(15, 23, 42, 0.02)",
  borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
  whiteSpace: "nowrap",
};

const thBtnStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  fontWeight: "inherit",
  opacity: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 750,
  borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const tdStyleStrong: React.CSSProperties = { ...tdStyle, fontWeight: 950 };
const tdStyleCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };

const emptyStyle: React.CSSProperties = { padding: 16, textAlign: "center", opacity: 0.65, fontWeight: 800 };

const iconBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const iconBtnDangerStyle: React.CSSProperties = { ...iconBtnStyle, border: "1px solid rgba(220, 38, 38, 0.20)", color: "rgb(220,38,38)" };

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: 44,
  right: 0,
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
  padding: 12,
  minWidth: 240,
  zIndex: 30,
};

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.30)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, zIndex: 50 };

const modalStyle: React.CSSProperties = { width: "min(820px, 96vw)", maxHeight: "min(78vh, 820px)", background: "white", borderRadius: 14, border: "1px solid rgba(15, 23, 42, 0.12)", boxShadow: "0 18px 60px rgba(2, 6, 23, 0.22)", overflow: "hidden" };

const modalHeaderStyle: React.CSSProperties = { padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" };
const modalBodyStyle: React.CSSProperties = { padding: 14, overflow: "auto", maxHeight: "calc(min(78vh, 820px) - 120px)" };
const modalFooterStyle: React.CSSProperties = { padding: 14, display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid rgba(15, 23, 42, 0.08)" };

const inlineErrorStyle: React.CSSProperties = {
  margin: "0 14px 10px 14px",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(220,38,38,0.08)",
  color: "rgb(220,38,38)",
  fontWeight: 900,
  fontSize: 13,
};

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 };

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  outline: "none",
  fontWeight: 800,
};

/* ================== SORT ================== */
type SortKey =
  | "start_date"
  | "name"
  | "product_name"
  | "client_name"
  | "delivery_type"
  | "location_city"
  | "duration_days"
  | "certification_date"
  | "learners_count";

type SortState = { key: SortKey; dir: "asc" | "desc" };

function compareNullable(a: any, b: any, dir: 1 | -1) {
  if (a == null && b == null) return 0;
  if (a == null) return -1 * dir;
  if (b == null) return 1 * dir;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b), "fr", { numeric: true }) * dir;
}

function sortSessions(rows: SessionRow[], sort: SortState, learnerCountBySession: Record<string, number>) {
  const dir = sort.dir === "asc" ? (1 as const) : (-1 as const);

  return [...rows].sort((ra, rb) => {
    if (sort.key === "duration_days") {
      const va = daysBetweenInclusive(ra.start_date, ra.end_date);
      const vb = daysBetweenInclusive(rb.start_date, rb.end_date);
      return compareNullable(va, vb, dir);
    }

    if (sort.key === "learners_count") {
      const va = learnerCountBySession[ra.id] ?? 0;
      const vb = learnerCountBySession[rb.id] ?? 0;
      return compareNullable(va, vb, dir);
    }

    const a: any = ra as any;
    const b: any = rb as any;
    return compareNullable(a[sort.key], b[sort.key], dir);
  });
}

/* ================== PAGE ================== */
export default function SessionsPage() {
  const { allowedPages, isLoading } = usePermissions() as any;

  const canCreate = !isLoading && (allowedPages?.includes?.("sessions:create") ?? false);
  const canEdit = !isLoading && (allowedPages?.includes?.("sessions:edit") ?? false);
  const canDelete = !isLoading && (allowedPages?.includes?.("sessions:delete") ?? false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUserId(data.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const [rows, setRows] = useState<SessionRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryType | "ALL">("ALL");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "UPCOMING" | "ONGOING" | "PAST">("ALL");
  const [sort, setSort] = useState<SortState>({ key: "start_date", dir: "desc" });

  // Apprenants (VIEW)
  const [viewLearners, setViewLearners] = useState<LearnerRow[]>([]);
  const [viewLearnersLoading, setViewLearnersLoading] = useState(false);
  const [viewLearnersError, setViewLearnersError] = useState<string | null>(null);

  // Compteur apprenants par session
  const [learnerCountBySession, setLearnerCountBySession] = useState<Record<string, number>>({});

  // Sous-traitants invités (pour delivery_type = sous_traitee)
  const [subcontractors, setSubcontractors] = useState<SubcontractorRow[]>([]);
  const [subcontractorsLoading, setSubcontractorsLoading] = useState(false);

  function toggleSort(key: SortKey, defaultDir: "asc" | "desc" = "asc") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  }

  function sortArrow(key: SortKey) {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  }

  const [cols, setCols] = useState({
    dates: true,
    name: true,
    product: true,
    client: true,
    type: true,
    city: true,
    duration: true,
    learners: true,
    certification: true,
    actions: true,
  });

  const [openCols, setOpenCols] = useState(false);
  const colsBtnRef = useRef<HTMLButtonElement | null>(null);
  const colsPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!openCols) return;
      const t = e.target as Node;
      if (colsBtnRef.current && colsBtnRef.current.contains(t)) return;
      if (colsPopRef.current && colsPopRef.current.contains(t)) return;
      setOpenCols(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openCols]);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const [form, setForm] = useState({
    product_id: "",
    name: "",
    delivery_type: "direct" as DeliveryType,
    subcontractor_user_id: "",
    client_id: "",
    start_date: "",
    end_date: "",
    certification_date: "",
    location_structure: "",
    location_street: "",
    location_postal_code: "",
    location_city: "",
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => {
      if (key === "end_date") {
        const end = String(value ?? "");
        return { ...p, end_date: end, certification_date: end };
      }

      if (key === "delivery_type") {
        const dt = String(value ?? "") as DeliveryType;
        // si on quitte "sous_traitee" => on vide le sous-traitant
        if (dt !== "sous_traitee") {
          return { ...p, delivery_type: dt, subcontractor_user_id: "" } as any;
        }
        return { ...p, delivery_type: dt } as any;
      }

      return { ...p, [key]: value };
    });
  }

  function resetForm() {
    setFormError(null);
    setForm({
      product_id: "",
      name: "",
      delivery_type: "direct",
      subcontractor_user_id: "",
      client_id: "",
      start_date: "",
      end_date: "",
      certification_date: "",
      location_structure: "",
      location_street: "",
      location_postal_code: "",
      location_city: "",
    });
  }

  // Hack: masque un ancien bandeau Sessions/Colonnes
  useEffect(() => {
    const root = document.getElementById("sessions-new-ui-root");
    if (!root) return;

    const hideForeignSessionsBand = () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const colonnesButtons = buttons.filter((b) => (b.textContent ?? "").toLowerCase().includes("colonnes"));

      for (const btn of colonnesButtons) {
        if (root.contains(btn)) continue;

        let el: HTMLElement | null = btn as HTMLElement;
        for (let i = 0; i < 6 && el; i++) {
          const txt = (el.innerText ?? "").trim().toLowerCase();
          if (txt.includes("sessions") && txt.includes("colonnes")) {
            el.style.display = "none";
            el.style.visibility = "hidden";
            el.style.pointerEvents = "none";
            break;
          }
          el = el.parentElement;
        }
      }
    };

    hideForeignSessionsBand();
    const obs = new MutationObserver(() => hideForeignSessionsBand());
    obs.observe(document.body, { childList: true, subtree: true });

    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrap() {
    setLoading(true);
    setPageError(null);
    try {
      await Promise.all([fetchClients(), fetchProducts()]);
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    const { data, error } = await supabase.from(CLIENTS_TABLE).select("id,name").order("name", { ascending: true });
    if (error) {
      setPageError(error.message);
      setClients([]);
      return;
    }
    setClients((data ?? []) as ClientRow[]);
  }

  async function fetchProducts() {
    const { data, error } = await supabase.from(PRODUCTS_TABLE).select("id,name").order("name", { ascending: true });
    if (error) {
      setPageError(error.message);
      setProducts([]);
      return;
    }
    setProducts((data ?? []) as ProductRow[]);
  }

  async function fetchSubcontractors() {
    setSubcontractorsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_invited_subcontractors");
      if (error) {
        setSubcontractors([]);
        return;
      }
      setSubcontractors((data ?? []) as SubcontractorRow[]);
    } finally {
      setSubcontractorsLoading(false);
    }
  }

  async function fetchLearnerCountsForSessions(sessionIds: string[]) {
    if (sessionIds.length === 0) {
      setLearnerCountBySession({});
      return;
    }

    const { data, error } = await supabase.from("apprenant_sessions").select("session_id").in("session_id", sessionIds);

    if (error) {
      const fallback: Record<string, number> = {};
      for (const id of sessionIds) fallback[id] = 0;
      setLearnerCountBySession(fallback);
      return;
    }

    const map: Record<string, number> = {};
    for (const id of sessionIds) map[id] = 0;

    for (const r of data ?? []) {
      const sid = (r as any).session_id as string | undefined;
      if (!sid) continue;
      map[sid] = (map[sid] ?? 0) + 1;
    }

    setLearnerCountBySession(map);
  }

  async function fetchSessions() {
    setPageError(null);

    const { data, error } = await supabase.rpc("get_my_visible_sessions");

  if (error) {
  if ((error.message || "").toLowerCase().includes("forbidden")) {
    setPageError(null);
    setRows([]);
    setLearnerCountBySession({});
    return;
  }
  setPageError(error.message);
  setRows([]);
  setLearnerCountBySession({});
  return;
}



    const raw = (data ?? []) as SessionRow[];

    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const prodMap = new Map(products.map((p) => [p.id, p.name]));

    const enriched = raw.map((r) => ({
  ...r,
  client_name: (r as any).client_name ?? (r.client_id ? clientMap.get(r.client_id) ?? "—" : "—"),
  product_name: (r as any).product_name ?? (r.product_id ? prodMap.get(r.product_id) ?? "—" : "—"),
}));


    setRows(enriched);

    await fetchLearnerCountsForSessions(enriched.map((s) => s.id));
  }

  const kpi = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const prevYear = nowYear - 1;

    const thisYear = rows.filter((r) => yearOf(r.start_date) === nowYear);
    const prevYearRows = rows.filter((r) => yearOf(r.start_date) === prevYear);

    const upcoming = rows.filter((r) => statusOfSession(r) === "UPCOMING");
    const subcontract = rows.filter((r) => r.delivery_type === "subcontract");
    const direct = rows.filter((r) => r.delivery_type === "direct");

    const totalDaysThisYear = thisYear.reduce((acc, r) => acc + daysBetweenInclusive(r.start_date, r.end_date), 0);
    const totalDaysPrevYear = prevYearRows.reduce((acc, r) => acc + daysBetweenInclusive(r.start_date, r.end_date), 0);

    return {
      nowYear,
      prevYear,
      countThisYear: thisYear.length,
      countPrevYear: prevYearRows.length,
      totalDaysThisYear,
      totalDaysPrevYear,
      upcomingCount: upcoming.length,
      directCount: direct.length,
      subcontractCount: subcontract.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = safeLower(q.trim());

    const base = rows.filter((r) => {
      const matchesQ =
        !qq ||
        safeLower(r.name).includes(qq) ||
        safeLower(r.client_name).includes(qq) ||
        safeLower(r.product_name).includes(qq) ||
        safeLower(r.location_city).includes(qq) ||
        safeLower(r.location_structure).includes(qq);

      const matchesDelivery = deliveryFilter === "ALL" ? true : r.delivery_type === deliveryFilter;

      const st = statusOfSession(r);
      const matchesTime = timeFilter === "ALL" ? true : st === timeFilter;

      return matchesQ && matchesDelivery && matchesTime;
    });

    return sortSessions(base, sort, learnerCountBySession);
  }, [rows, q, deliveryFilter, timeFilter, sort, learnerCountBySession]);

  function openCreateModal() {
    resetForm();
    setSelectedId(null);
    setOpenCreate(true);
  }
  function closeCreateModal() {
    setOpenCreate(false);
    setFormError(null);
  }

  function openViewModal(id: string) {
    setSelectedId(id);
    setOpenView(true);
    void loadLearnersForSession(id);
  }
  function closeViewModal() {
    setOpenView(false);
    setSelectedId(null);
    setViewLearners([]);
    setViewLearnersError(null);
  }

  function openEditModal(id: string) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;

    const isSubcontractSession = r.delivery_type === "subcontract" && r.subcontractor_user_id === userId;
    if (isSubcontractSession) return;

    setSelectedId(id);
    setFormError(null);

    setForm({
      product_id: r.product_id ?? "",
      name: r.name ?? "",
      delivery_type: (r.delivery_type ?? "direct") as DeliveryType,
      subcontractor_user_id: r.subcontractor_user_id ?? "",
      client_id: r.client_id ?? "",
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      certification_date: r.certification_date ?? "",
      location_structure: r.location_structure ?? "",
      location_street: r.location_street ?? "",
      location_postal_code: r.location_postal_code ?? "",
      location_city: r.location_city ?? "",
    });

    setOpenEdit(true);
  }
  function closeEditModal() {
    setOpenEdit(false);
    setFormError(null);
  }

  // charge la liste au moment où on ouvre une modale + type = sous_traitee
  useEffect(() => {
    const need = (openCreate || openEdit) && form.delivery_type === "sous_traitee";
    if (!need) return;
    void fetchSubcontractors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate, openEdit, form.delivery_type]);

  function validateForm() {
    if (!required(form.product_id)) return "Merci de choisir une formation.";
    if (!required(form.name)) return "Nom de session requis.";
    if (!required(form.start_date) || !required(form.end_date)) return "Dates (du / au) requises.";

    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Dates invalides.";
    if (e < s) return "La date de fin doit être après la date de début.";

    if (form.delivery_type === "sous_traitee" && !required(form.subcontractor_user_id)) {
      return "Merci de choisir un formateur sous-traitant (invité).";
    }

    return null;
  }

  async function saveCreate() {
    if (!canCreate) {
      setFormError("Accès refusé.");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      setFormError(null);
      const err = validateForm();
      if (err) return setFormError(err);

      const org = await supabase.rpc("current_org_id");
      if (org.error || !org.data) return setFormError(org.error?.message ?? "Organisation introuvable.");

      const payload: Partial<SessionRow> = {
        org_id: org.data as string,
        product_id: form.product_id || null,
        name: form.name.trim(),
        delivery_type: form.delivery_type,
        subcontractor_user_id: form.delivery_type === "sous_traitee" ? form.subcontractor_user_id || null : null,
        client_id: form.client_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
        certification_date: form.end_date || null,

        location_structure: form.location_structure.trim() || null,
        location_street: form.location_street.trim() || null,
        location_postal_code: form.location_postal_code.trim() || null,
        location_city: form.location_city.trim() || null,
      };

      const { data: created, error } = await supabase
        .from(SESSIONS_TABLE)
        .insert(payload)
        .select("id,product_id,client_id,start_date,end_date,location_structure")
        .maybeSingle();

      if (error || !created?.id) return setFormError(error?.message ?? "Création impossible.");

      const go = window.confirm("Session créée ✅\n\nVoulez-vous ajouter plusieurs apprenants maintenant ?");
      if (go) {
        const params = new URLSearchParams({
          multi: "1",
          session_id: created.id,
          product_id: created.product_id ?? "",
          client_id: created.client_id ?? "",
          start_date: created.start_date ?? "",
          end_date: created.end_date ?? "",
          structure: created.location_structure ?? "",
        });

        window.location.href = `/apprenants?${params.toString()}`;
        return;
      }

      closeCreateModal();
      await fetchSessions();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!canEdit) {
      setFormError("Accès refusé.");
      return;
    }
    if (!selectedId || saving) return;

    setSaving(true);
    try {
      setFormError(null);
      const err = validateForm();
      if (err) return setFormError(err);

      const payload: Partial<SessionRow> = {
        product_id: form.product_id || null,
        name: form.name.trim(),
        delivery_type: form.delivery_type,
        subcontractor_user_id: form.delivery_type === "sous_traitee" ? form.subcontractor_user_id || null : null,
        client_id: form.client_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
        certification_date: form.end_date || null,

        location_structure: form.location_structure.trim() || null,
        location_street: form.location_street.trim() || null,
        location_postal_code: form.location_postal_code.trim() || null,
        location_city: form.location_city.trim() || null,
      };

      const { error } = await supabase.from(SESSIONS_TABLE).update(payload).eq("id", selectedId);
      if (error) return setFormError(error.message);

      closeEditModal();
      await fetchSessions();
    } finally {
      setSaving(false);
    }
  }

async function deleteRow(id: string) {
  if (!canDelete) return;

  const ok = window.confirm("Supprimer cette session ?");
  if (!ok) return;

  setPageError(null);

  const { data, error } = await supabase.rpc("delete_session", { p_session_id: id });

  if (error) {
    setPageError(error.message);
    return;
  }

  if (data !== true) {
    setPageError("Suppression impossible.");
    return;
  }

  // UX: disparition immédiate
  setRows((prev) => prev.filter((r) => r.id !== id));
  setLearnerCountBySession((prev) => {
    const next = { ...prev };
    delete next[id];
    return next;
  });

  // sync
  await fetchSessions();
}



  async function loadLearnersForSession(sessionId: string) {
    setViewLearners([]);
    setViewLearnersError(null);
    setViewLearnersLoading(true);

    try {
      const org = await supabase.rpc("current_org_id");
      const orgId = org.data as string | null;
      if (!orgId) {
        setViewLearnersError("Organisation introuvable.");
        return;
      }

      const { data: links, error: linkErr } = await supabase
        .from("apprenant_sessions")
        .select("apprenant_id")
        .eq("org_id", orgId)
        .eq("session_id", sessionId);

      if (linkErr) {
        setViewLearnersError(linkErr.message);
        return;
      }

      const apprenantIds = (links ?? []).map((x: any) => x.apprenant_id).filter(Boolean);

      if (apprenantIds.length === 0) {
        setViewLearners([]);
        return;
      }

      const { data: apprenants, error: apprErr } = await supabase
        .from("apprenants")
        .select("id,last_name,first_name,email")
        .eq("org_id", orgId)
        .in("id", apprenantIds)
        .order("last_name", { ascending: true });

      if (apprErr) {
        setViewLearnersError(apprErr.message);
        return;
      }

      setViewLearners((apprenants ?? []) as any[]);
    } finally {
      setViewLearnersLoading(false);
    }
  }

  return (
    <div id="sessions-new-ui-root" style={containerStyle}>
      <style jsx>{`
        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }
        @media (max-width: 1100px) {
          .kpiGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .kpiGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 460px) {
          .kpiGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header */}
      <div style={headerRowStyle}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.2 }}>Sessions</div>
          <div style={{ opacity: 0.6, marginTop: 2 }}>Gestion des sessions</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={softBtnStyle} onClick={() => void bootstrap()} disabled={loading} type="button">
            Rafraîchir
          </button>

          {canCreate && (
            <button style={primaryBtnStyle} onClick={openCreateModal} type="button">
              + Nouvelle session
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="kpiGrid" style={kpiGridStyle}>
        <KpiCard title={`Sessions ${kpi.nowYear}`} value={`${kpi.countThisYear}`} sub={`${kpi.prevYear}: ${kpi.countPrevYear}`} tone="green" icon="📅" />
        <KpiCard title={`Jours de formation ${kpi.nowYear}`} value={`${kpi.totalDaysThisYear}`} sub={`${kpi.prevYear} : ${kpi.totalDaysPrevYear} jours`} tone="orange" icon="⏱" />
        <KpiCard title="À venir" value={`${kpi.upcomingCount}`} sub="sessions" tone="blue" icon="🗓️" />
        <KpiCard title="Clients direct" value={`${kpi.directCount}`} sub="sessions" tone="blue" icon="👤" />
        <KpiCard title="Sous-traitance" value={`${kpi.subcontractCount}`} sub="sessions" tone="red" icon="🔁" />
      </div>

      {/* Tableau */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={sectionHeaderStyle}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Liste des sessions</div>

          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <button ref={colsBtnRef} style={softBtnStyle} type="button" onClick={() => setOpenCols((v) => !v)}>
              ⚙ Colonnes
            </button>

            {openCols && (
              <div ref={colsPopRef} style={popoverStyle}>
                <div style={{ fontWeight: 950, marginBottom: 10, opacity: 0.8 }}>Afficher</div>

                {(
                  [
                    ["dates", "Dates"],
                    ["name", "Nom"],
                    ["product", "Formation"],
                    ["client", "Client"],
                    ["type", "Type"],
                    ["city", "Ville"],
                    ["duration", "Durée"],
                    ["learners", "Apprenants"],
                    ["certification", "Certification"],
                    ["actions", "Actions"],
                  ] as Array<[keyof typeof cols, string]>
                ).map(([k, label]) => (
                  <label
                    key={k}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 10px", borderRadius: 12, fontWeight: 900 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span>{label}</span>
                    <input type="checkbox" checked={(cols as any)[k]} onChange={() => setCols((c) => ({ ...c, [k]: !(c as any)[k] }))} />
                  </label>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    style={softBtnStyle}
                    type="button"
                    onClick={() =>
                      setCols({
                        dates: true,
                        name: true,
                        product: true,
                        client: true,
                        type: true,
                        city: true,
                        duration: true,
                        learners: true,
                        certification: true,
                        actions: true,
                      })
                    }
                  >
                    Reset
                  </button>

                  <button style={softBtnStyle} type="button" onClick={() => setOpenCols(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            )}

            <button style={softBtnStyle} onClick={() => void bootstrap()} disabled={loading} type="button">
              Rafraîchir
            </button>
          </div>
        </div>

        <div style={filtersRowStyle}>
          <div style={searchWrapStyle}>
            <input style={searchInputStyle} placeholder="Rechercher une session…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <select style={selectStyle} value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as any)} title="Période">
            <option value="ALL">Tous</option>
            <option value="UPCOMING">À venir</option>
            <option value="ONGOING">En cours</option>
            <option value="PAST">Terminées</option>
          </select>

          <select style={selectStyle} value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as any)} title="Type">
            <option value="ALL">Tous types</option>
            <option value="direct">Client direct</option>
            <option value="subcontract">Sous-traitance</option>
            <option value="sous_traitee">Sous-traitée</option>
          </select>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {cols.dates && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("start_date", "desc")}>
                      Dates{sortArrow("start_date")}
                    </button>
                  </th>
                )}
                {cols.name && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("name", "asc")}>
                      Session{sortArrow("name")}
                    </button>
                  </th>
                )}
                {cols.product && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("product_name", "asc")}>
                      Formation{sortArrow("product_name")}
                    </button>
                  </th>
                )}
                {cols.client && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("client_name", "asc")}>
                      Client{sortArrow("client_name")}
                    </button>
                  </th>
                )}
                {cols.type && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("delivery_type", "asc")}>
                      Type{sortArrow("delivery_type")}
                    </button>
                  </th>
                )}
                {cols.city && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("location_city", "asc")}>
                      Ville{sortArrow("location_city")}
                    </button>
                  </th>
                )}
                {cols.duration && (
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("duration_days", "desc")}>
                      Durée{sortArrow("duration_days")}
                    </button>
                  </th>
                )}
                {cols.learners && (
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("learners_count", "desc")}>
                      Apprenants{sortArrow("learners_count")}
                    </button>
                  </th>
                )}
                {cols.certification && (
                  <th style={thStyle}>
                    <button style={thBtnStyle} type="button" onClick={() => toggleSort("certification_date", "desc")}>
                      Certification{sortArrow("certification_date")}
                    </button>
                  </th>
                )}
                {cols.actions && <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Aucune session
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isSubcontractSession = r.delivery_type === "subcontract" && r.subcontractor_user_id === userId;
                  const durDays = daysBetweenInclusive(r.start_date, r.end_date);
                  const learnersCount = learnerCountBySession[r.id] ?? 0;

                  return (
                    <tr key={r.id}>
                      {cols.dates && (
                        <td style={tdStyle}>
                          {toFrDate(r.start_date)} → {toFrDate(r.end_date)}
                        </td>
                      )}

                      {cols.name && <td style={tdStyleStrong}>{r.name ?? "—"}</td>}
                      {cols.product && <td style={tdStyle}>{r.product_name ?? "—"}</td>}
                      {cols.client && <td style={tdStyle}>{r.client_name ?? "—"}</td>}

                      {cols.type && (
                        <td style={tdStyle}>
                          <StatusPill
                            tone={r.delivery_type === "subcontract" ? "red" : r.delivery_type === "sous_traitee" ? "orange" : "blue"}
                            label={r.delivery_type === "subcontract" ? "Sous-traitance" : r.delivery_type === "sous_traitee" ? "Sous-traitée" : "Client direct"}
                          />
                        </td>
                      )}

                      {cols.city && <td style={tdStyle}>{r.location_city ?? "—"}</td>}
                      {cols.duration && <td style={tdStyleCenter}>{durDays > 0 ? `${durDays} j` : "—"}</td>}
                      {cols.learners && <td style={tdStyleCenter}>{learnersCount}</td>}
                      {cols.certification && <td style={tdStyle}>{toFrDate(r.certification_date)}</td>}

                      {cols.actions && (
                        <td style={tdStyleCenter}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <button style={iconBtnStyle} onClick={() => openViewModal(r.id)} title="Voir" type="button">
                              👁
                            </button>

                            {canEdit && !isSubcontractSession && (
                              <button style={iconBtnStyle} onClick={() => openEditModal(r.id)} title="Modifier" type="button">
                                ✎
                              </button>
                            )}

                            {canDelete && !isSubcontractSession && (
                              <button style={iconBtnDangerStyle} onClick={() => void deleteRow(r.id)} title="Supprimer" type="button">
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageError && !openCreate && !openEdit && !openView && <div style={{ padding: 12, color: "rgb(220,38,38)", fontWeight: 900 }}>{pageError}</div>}
      </div>

      {/* ===================== MODALE VIEW SESSION ===================== */}
      {openView && selected && (
        <div style={overlayStyle} onMouseDown={closeViewModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.2 }}>Visualisation session</div>
                <div style={{ opacity: 0.65, fontWeight: 800, marginTop: 2 }}>{selected.name}</div>
              </div>

              <button style={softBtnStyle} onClick={closeViewModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div style={cardStyle}>
                  <div style={{ padding: 12 }}>
                    <div style={labelStyle}>Formation</div>
                    <div style={{ fontWeight: 950 }}>{selected.product_name ?? "—"}</div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ padding: 12 }}>
                    <div style={labelStyle}>Client</div>
                    <div style={{ fontWeight: 950 }}>{selected.client_name ?? "—"}</div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ padding: 12 }}>
                    <div style={labelStyle}>Dates</div>
                    <div style={{ fontWeight: 950 }}>
                      {toFrDate(selected.start_date)} → {toFrDate(selected.end_date)}
                    </div>
                    <div style={{ opacity: 0.65, fontWeight: 800, marginTop: 4 }}>
                      Durée : {daysBetweenInclusive(selected.start_date, selected.end_date)} jour(s)
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ padding: 12 }}>
                    <div style={labelStyle}>Type</div>
                    <div style={{ fontWeight: 950 }}>
                      {selected.delivery_type === "direct" ? "Client direct" : selected.delivery_type === "sous_traitee" ? "Sous-traitée" : "Sous-traitance"}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={labelStyle}>Date certification</div>
                      <div style={{ fontWeight: 950 }}>{toFrDate(selected.certification_date)}</div>
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ padding: 12 }}>
                    <div style={labelStyle}>Lieu</div>
                    <div style={{ fontWeight: 950 }}>
                      {selected.location_structure ?? "—"}
                      {selected.location_street ? `, ${selected.location_street}` : ""}
                    </div>
                    <div style={{ opacity: 0.7, fontWeight: 800, marginTop: 4 }}>
                      {(selected.location_postal_code ?? "").trim()}
                      {selected.location_postal_code && selected.location_city ? " " : ""}
                      {(selected.location_city ?? "").trim()}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, ...cardStyle }}>
                <div style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950 }}>Apprenants liés ({viewLearners.length})</div>

                    <button
                      style={softBtnStyle}
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams({
                          multi: "1",
                          session_id: selected.id,
                          product_id: selected.product_id ?? "",
                          client_id: selected.client_id ?? "",
                          start_date: selected.start_date ?? "",
                          end_date: selected.end_date ?? "",
                          structure: selected.location_structure ?? "",
                        });
                        window.location.href = `/apprenants?${params.toString()}`;
                      }}
                    >
                      + Ajouter / lier
                    </button>
                  </div>

                  {viewLearnersError && <div style={{ marginTop: 10, ...inlineErrorStyle }}>{viewLearnersError}</div>}
                </div>

                <div style={{ padding: 12 }}>
                  {viewLearnersLoading ? (
                    <div style={{ opacity: 0.7, fontWeight: 850 }}>Chargement…</div>
                  ) : viewLearners.length === 0 ? (
                    <div style={{ opacity: 0.65, fontWeight: 850 }}>Aucun apprenant lié à cette session.</div>
                  ) : (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Nom</th>
                            <th style={thStyle}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewLearners.map((l) => (
                            <tr key={l.id}>
                              <td style={tdStyleStrong}>{getLearnerName(l)}</td>
                              <td style={tdStyle}>{getLearnerEmail(l) || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={modalFooterStyle}>
              {canEdit && selected.delivery_type !== "subcontract" && (
                <button
                  style={softBtnStyle}
                  type="button"
                  onClick={() => {
                    closeViewModal();
                    openEditModal(selected.id);
                  }}
                >
                  Modifier
                </button>
              )}

              <button style={primaryBtnStyle} onClick={closeViewModal} type="button">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE */}
      {openCreate && (
        <div style={overlayStyle} onMouseDown={closeCreateModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Créer une session</div>
              <button style={softBtnStyle} onClick={closeCreateModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <SessionForm
                form={form}
                setField={setField as any}
                clients={clients}
                products={products}
                subcontractors={subcontractors}
                subcontractorsLoading={subcontractorsLoading}
              />
            </div>

            {formError && <div style={inlineErrorStyle}>{formError}</div>}

            <div style={modalFooterStyle}>
              <button style={softBtnStyle} onClick={closeCreateModal} disabled={saving} type="button">
                Annuler
              </button>
              <button style={{ ...primaryBtnStyle, opacity: saving ? 0.75 : 1 }} onClick={() => void saveCreate()} disabled={saving} type="button">
                {saving ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT */}
      {openEdit && (
        <div style={overlayStyle} onMouseDown={closeEditModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Modifier session</div>
              <button style={softBtnStyle} onClick={closeEditModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <SessionForm
                form={form}
                setField={setField as any}
                clients={clients}
                products={products}
                subcontractors={subcontractors}
                subcontractorsLoading={subcontractorsLoading}
              />
            </div>

            {formError && <div style={inlineErrorStyle}>{formError}</div>}

            <div style={modalFooterStyle}>
              <button style={softBtnStyle} onClick={closeEditModal} disabled={saving} type="button">
                Annuler
              </button>
              <button style={{ ...primaryBtnStyle, opacity: saving ? 0.75 : 1 }} onClick={() => void saveEdit()} disabled={saving} type="button">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== FORM ================== */
function SessionForm(props: {
  form: any;
  setField: <K extends string>(key: K, value: any) => void;
  clients: ClientRow[];
  products: ProductRow[];
  subcontractors: SubcontractorRow[];
  subcontractorsLoading: boolean;
}) {
  const { form, setField, clients, products, subcontractors, subcontractorsLoading } = props;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Formation *</div>
          <select style={selectStyle} value={form.product_id} onChange={(e) => setField("product_id", e.target.value)}>
            <option value="" disabled>
              Sélectionner…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Nom de session *</div>
          <input style={inputStyle} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Session Janvier" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Client (optionnel)</div>
          <select style={selectStyle} value={form.client_id} onChange={(e) => setField("client_id", e.target.value)}>
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Type *</div>
          <select style={selectStyle} value={form.delivery_type} onChange={(e) => setField("delivery_type", e.target.value)}>
            <option value="direct">Client direct</option>
            <option value="subcontract">Sous-traitance</option>
            <option value="sous_traitee">Sous-traitée</option>
          </select>
        </div>
      </div>

      {form.delivery_type === "sous_traitee" && (
        <div>
          <div style={labelStyle}>Formateur sous-traitant (invité) *</div>
          <select
            style={selectStyle}
            value={form.subcontractor_user_id}
            onChange={(e) => setField("subcontractor_user_id", e.target.value)}
            disabled={subcontractorsLoading}
          >
            <option value="">{subcontractorsLoading ? "Chargement..." : "Sélectionner…"}</option>
            {subcontractors.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.display_name}
                {s.email ? ` — ${s.email}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Du *</div>
          <input type="date" style={inputStyle} value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
        </div>

        <div>
          <div style={labelStyle}>Au *</div>
          <input type="date" style={inputStyle} value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
        </div>
      </div>

      <div>
        <div style={labelStyle}>Date certification (auto = date de fin)</div>
        <input type="date" style={{ ...inputStyle, background: "#fafafa" }} value={form.certification_date} readOnly />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Structure</div>
          <input style={inputStyle} value={form.location_structure} onChange={(e) => setField("location_structure", e.target.value)} />
        </div>
        <div>
          <div style={labelStyle}>Rue</div>
          <input style={inputStyle} value={form.location_street} onChange={(e) => setField("location_street", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Code postal</div>
          <input style={inputStyle} value={form.location_postal_code} onChange={(e) => setField("location_postal_code", e.target.value)} />
        </div>
        <div>
          <div style={labelStyle}>Ville</div>
          <input style={inputStyle} value={form.location_city} onChange={(e) => setField("location_city", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ================== UI bits ================== */
function KpiCard(props: { title: string; value: string; sub: string; tone: "green" | "orange" | "red" | "blue"; icon: string }) {
  const toneMap: Record<string, { bg: string; icBg: string }> = {
    green: { bg: "rgba(34,197,94,0.08)", icBg: "rgba(34,197,94,1)" },
    orange: { bg: "rgba(245,158,11,0.10)", icBg: "rgba(245,158,11,1)" },
    red: { bg: "rgba(239,68,68,0.10)", icBg: "rgba(239,68,68,1)" },
    blue: { bg: "rgba(59,130,246,0.10)", icBg: "rgba(59,130,246,1)" },
  };
  const t = toneMap[props.tone];

  return (
    <div style={{ ...cardStyle, padding: 14, background: t.bg }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.7 }}>{props.title}</div>
          <div style={{ fontSize: 40, fontWeight: 980, letterSpacing: -0.5, marginTop: 8 }}>{props.value}</div>
          <div style={{ marginTop: 6, opacity: 0.65, fontWeight: 900 }}>{props.sub}</div>
        </div>

        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: t.icBg,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 950,
          }}
        >
          {props.icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill(props: { label: string; tone: "green" | "orange" | "red" | "blue" }) {
  const bg =
    props.tone === "green"
      ? "rgba(34,197,94,0.12)"
      : props.tone === "orange"
      ? "rgba(245,158,11,0.14)"
      : props.tone === "red"
      ? "rgba(239,68,68,0.14)"
      : "rgba(59,130,246,0.14)";

  const fg =
    props.tone === "green"
      ? "rgb(22,163,74)"
      : props.tone === "orange"
      ? "rgb(217,119,6)"
      : props.tone === "red"
      ? "rgb(220,38,38)"
      : "rgb(37,99,235)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 950,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {props.label}
    </span>
  );
}
