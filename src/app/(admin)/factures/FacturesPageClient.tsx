"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* =========================================================
   Devis & Factures — UI calée sur Sessions (propre)
   - Header + KPI cards (avec icône + fond ton)
   - Card "Factures" + card "Devis"
   - Colonnes: popover en haut (pas en bas)
   - Table triable
   - Modales: Créer / Modifier / Voir + mini modale client
   - Contenu & logique identiques
========================================================= */

/* ================== TABLE NAMES ================== */
const BILLING_TABLE = "billing_documents";
const CLIENTS_TABLE = "clients";
const PRODUCTS_TABLE = "products";

/* ================== TYPES ================== */
type BillingType = "INVOICE" | "QUOTE";

type InvoiceStatus = "A_FACTURER" | "TRANSMISE" | "RELANCEE" | "ENCAISSEE";
type QuoteStatus = "EN_COURS" | "SANS_SUITE" | "NON_RETENU";
type BillingStatus = InvoiceStatus | QuoteStatus;

type ClientRow = { id: string; name: string; org_id?: string | null };

// products: durée en heures
type ProductRow = { id: string; name: string; nb_hours: number | null };

type BillingRow = {
  id: string;
  org_id: string;

  type: BillingType;
  date: string; // YYYY-MM-DD

  client_id: string | null;
  client_name?: string;

  structure: string | null;

  product_id: string | null;
  product_name?: string;

  nb_candidates: number | null;
  nb_days: number | null;

  amount_ht: number | null;
  amount_ttc: number;

  status: BillingStatus;
  document_number: string | null;

  // facture uniquement
  urssaf_paid: boolean | null;
  urssaf_amount: number | null;
  payment_date: string | null;

  created_at?: string;
  updated_at?: string;
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

const euro = (n?: number | null) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)} €`;
};

const parseDecimal = (s: string) => {
  const cleaned = String(s ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
};

const parseIntSafe = (s: string) => {
  const cleaned = String(s ?? "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
};

function isInvoice(row: BillingRow) {
  return row.type === "INVOICE";
}
function isQuote(row: BillingRow) {
  return row.type === "QUOTE";
}

function defaultStatusFor(type: BillingType): BillingStatus {
  return type === "INVOICE" ? "A_FACTURER" : "EN_COURS";
}

function yearOf(date: string | null | undefined) {
  if (!date) return null;
  const s = String(date).trim();

  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m1) return Number(m1[1]);

  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m2) return Number(m2[3]);

  const d = new Date(s);
  const y = d.getFullYear();
  return Number.isFinite(y) ? y : null;
}

/* ================== DURATION ================== */
const HOURS_PER_DAY = 7;

function splitHoursToDays(hours: number | null | undefined) {
  const h = Number(hours ?? 0);

  if (!Number.isFinite(h) || h <= 0) {
    return { days: 0, hours: 0, label: "—" };
  }

  // ✅ Règle métier : toute durée > 0 et < 7h = 1 jour minimum
  if (h < HOURS_PER_DAY) {
    return { days: 1, hours: 0, label: "1 j" };
  }

  const days = Math.floor(h / HOURS_PER_DAY);
  const rest = Math.round((h - days * HOURS_PER_DAY) * 100) / 100;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (rest > 0) parts.push(`${rest} h`);

  return { days, hours: rest, label: parts.join(" ") };
}

// ⚠️ À NE PAS SUPPRIMER : utilisé dans les map() JSX
function formatDurationFromHours(hours: number | null | undefined) {
  return splitHoursToDays(hours).label;
}
/* ================== URSSAF ================== */
const URSSAF_RATE = 0.27;
const urssafAuto = (ttc: number) => Number((ttc * URSSAF_RATE).toFixed(2));

/* ================== STYLES (comme Sessions) ================== */
const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
  padding: 18,
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 14,
  marginTop: 14,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.10)",
  borderRadius: 14,
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "14px 14px 10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const filtersRowStyle: React.CSSProperties = {
  padding: "0 14px 12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

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

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  borderTop: "1px solid rgba(15, 23, 42, 0.10)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "separate",
  borderSpacing: 0,
};

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
const tdStyleRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  opacity: 0.65,
  fontWeight: 800,
};

const iconBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const iconBtnDangerStyle: React.CSSProperties = {
  ...iconBtnStyle,
  border: "1px solid rgba(220, 38, 38, 0.20)",
  color: "rgb(220,38,38)",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  top: 40,
  right: 0,
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
  padding: 6,
  minWidth: 220,
  zIndex: 20,
};

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: 44,
  right: 0,
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
  padding: 12,
  minWidth: 260,
  zIndex: 30,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2, 6, 23, 0.30)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  zIndex: 50,
};

const modalStyle: React.CSSProperties = {
  width: "min(820px, 96vw)",
  maxHeight: "min(78vh, 820px)",
  background: "white",
  borderRadius: 14,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  boxShadow: "0 18px 60px rgba(2, 6, 23, 0.22)",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  padding: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
};

const modalBodyStyle: React.CSSProperties = {
  padding: 14,
  overflow: "auto",
  maxHeight: "calc(min(78vh, 820px) - 120px)",
};

const modalFooterStyle: React.CSSProperties = {
  padding: 14,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  borderTop: "1px solid rgba(15, 23, 42, 0.08)",
};

const inlineErrorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(220,38,38,0.08)",
  color: "rgb(220,38,38)",
  fontWeight: 900,
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.75,
  marginBottom: 6,
};

/* ================== SORT ================== */
type InvoiceSortKey = "date" | "client_name" | "amount_ttc" | "status" | "document_number";
type QuoteSortKey = "date" | "client_name" | "amount_ttc" | "status" | "document_number";
type SortState<K extends string> = { key: K; dir: "asc" | "desc" };

function compareNullable(a: any, b: any, dir: 1 | -1) {
  if (a == null && b == null) return 0;
  if (a == null) return -1 * dir;
  if (b == null) return 1 * dir;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b), "fr", { numeric: true }) * dir;
}

function sortRows<T extends BillingRow, K extends string>(rows: T[], sort: SortState<K>) {
  const dir = sort.dir === "asc" ? (1 as const) : (-1 as const);
  return [...rows].sort((a, b) => {
    const va = (a as any)[sort.key];
    const vb = (b as any)[sort.key];
    return compareNullable(va, vb, dir);
  });
}

function sortArrow(current: { key: string; dir: "asc" | "desc" }, key: string) {
  if (current.key !== key) return "";
  return current.dir === "asc" ? " ▲" : " ▼";
}

/* ================== PAGE ================== */
export default function FacturesDevisPage() {
  /* ========== DATA ========== */
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /* ========== FILTERS / SORT ========== */
  const [qInvoices, setQInvoices] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const [invoiceSort, setInvoiceSort] = useState<SortState<InvoiceSortKey>>({ key: "date", dir: "desc" });

  const [qQuotes, setQQuotes] = useState("");
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus | "ALL">("ALL");
  const [quoteSort, setQuoteSort] = useState<SortState<QuoteSortKey>>({ key: "date", dir: "desc" });

  const [invoiceCols, setInvoiceCols] = useState({
    date: true,
    client: true,
    structure: true,
    product: true,
    nb: true,
    duration: true,
    ttc: true,
    status: true,
    doc: true,
    urssaf: true,
    urssaf_amount: true,
    payment_date: true,
    actions: true,
  });

  const [quoteCols, setQuoteCols] = useState({
    date: true,
    client: true,
    structure: true,
    product: true,
    nb: true,
    duration: true,
    ttc: true,
    status: true,
    doc: true,
    actions: true,
  });

  /* ========== COLUMN POPOVERS ========== */
  const [openCols, setOpenCols] = useState<"INVOICE" | "QUOTE" | null>(null);

  const invColsBtnRef = useRef<HTMLButtonElement | null>(null);
  const invColsPopRef = useRef<HTMLDivElement | null>(null);

  const quoColsBtnRef = useRef<HTMLButtonElement | null>(null);
  const quoColsPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!openCols) return;
      const t = e.target as Node;

      if (openCols === "INVOICE") {
        if (invColsBtnRef.current && invColsBtnRef.current.contains(t)) return;
        if (invColsPopRef.current && invColsPopRef.current.contains(t)) return;
      }

      if (openCols === "QUOTE") {
        if (quoColsBtnRef.current && quoColsBtnRef.current.contains(t)) return;
        if (quoColsPopRef.current && quoColsPopRef.current.contains(t)) return;
      }

      setOpenCols(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openCols]);

  /* ========== MODALS ========== */
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  /* ========== CLIENT CREATE (mini) ========== */
  const [openCreateClient, setOpenCreateClient] = useState(false);
  const [clientCreateName, setClientCreateName] = useState("");

  /* ========== ACTION MENU "..." ========== */
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!openMenuFor) return;
      const t = e.target as Node;
      if (menuRef.current && menuRef.current.contains(t)) return;
      setOpenMenuFor(null);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [openMenuFor]);

  /* ========== FORM ========== */
  const [form, setForm] = useState({
    type: "INVOICE" as BillingType,

    date: "",
    client_id: "",
    structure: "",

    product_id: "",
    nb_candidates: "",
    nb_days: "",

    amount_ht: "",
    amount_ttc: "",

    status: "" as BillingStatus,
    document_number: "",

    urssaf_paid: false,
    urssaf_amount: "",
    payment_date: "",
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  /* ================== FETCH ================== */
  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrap() {
    setLoading(true);
    setPageError(null);
    try {
      await Promise.all([fetchClients(), fetchProducts()]);
      await fetchBilling();
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
    const { data, error } = await supabase.from(PRODUCTS_TABLE).select("*").order("name", { ascending: true });

    if (error) {
      console.error("fetchProducts error", error);
      setProducts([]);
      setPageError("Impossible de charger les formations (produits).");
      return;
    }

    const mapped = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name ?? p.label ?? p.title ?? "—",
      nb_hours: p.nb_hours ?? p.duration_hours ?? p.hours ?? null,
    })) as ProductRow[];

    setProducts(mapped);
  }

  async function fetchBilling() {
    setPageError(null);

    const { data, error } = await supabase.from(BILLING_TABLE).select("*").order("date", { ascending: false });

    if (error) {
      setPageError(error.message);
      setRows([]);
      return;
    }

    const raw = (data ?? []) as BillingRow[];

    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const prodMap = new Map(products.map((p) => [p.id, p.name]));

    const normalized = raw.map((r) => ({
      ...r,
      date: (r.date ? String(r.date).slice(0, 10) : r.date) as any,
      payment_date: (r.payment_date ? String(r.payment_date).slice(0, 10) : r.payment_date) as any,
    }));

    const enriched = normalized.map((r) => ({
      ...r,
      client_name: r.client_id ? clientMap.get(r.client_id) ?? "—" : "—",
      product_name: r.product_id ? prodMap.get(r.product_id) ?? "—" : "—",
    }));

    setRows(enriched);
  }

  /* ================== KPI ================== */
  const kpi = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const prevYear = nowYear - 1;

    const invoices = rows.filter(isInvoice);
    const quotes = rows.filter(isQuote);

    const caNow = invoices
      .filter((r) => yearOf(r.payment_date) === nowYear && r.status === "ENCAISSEE")
      .reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const caPrev = invoices
      .filter((r) => yearOf(r.payment_date) === prevYear && r.status === "ENCAISSEE")
      .reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const pendingInvoices = invoices.filter((r) => r.status !== "ENCAISSEE");
    const pendingAmount = pendingInvoices.reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const urssafPending = invoices
      .filter((r) => (r.urssaf_paid ?? false) === false)
      .reduce((acc, r) => acc + (Number(r.urssaf_amount) || 0), 0);

    const quotesSansSuite = quotes.filter((r) => r.status === "SANS_SUITE");
    const quotesSansSuiteAmount = quotesSansSuite.reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const quotesNonRetenus = quotes.filter((r) => r.status === "NON_RETENU");
    const quotesNonRetenusAmount = quotesNonRetenus.reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    return {
      nowYear,
      prevYear,
      caNow,
      caPrev,
      pendingAmount,
      pendingCount: pendingInvoices.length,
      urssafPending,
      quotesSansSuiteAmount,
      quotesSansSuiteCount: quotesSansSuite.length,
      quotesNonRetenusAmount,
      quotesNonRetenusCount: quotesNonRetenus.length,
    };
  }, [rows]);

  /* ================== FILTERED LISTS ================== */
  const invoicesFiltered = useMemo(() => {
    const qq = safeLower(qInvoices.trim());

    const filtered = rows.filter((r) => {
      if (!isInvoice(r)) return false;

      const matchesQ =
        !qq ||
        safeLower(r.client_name).includes(qq) ||
        safeLower(r.structure).includes(qq) ||
        safeLower(r.product_name).includes(qq) ||
        safeLower(r.document_number).includes(qq);

      const matchesStatus = invoiceStatus === "ALL" ? true : (r.status as InvoiceStatus) === invoiceStatus;
      return matchesQ && matchesStatus;
    });

    return sortRows(filtered, invoiceSort);
  }, [rows, qInvoices, invoiceStatus, invoiceSort]);

  const quotesFiltered = useMemo(() => {
    const qq = safeLower(qQuotes.trim());

    const filtered = rows.filter((r) => {
      if (!isQuote(r)) return false;

      const matchesQ =
        !qq ||
        safeLower(r.client_name).includes(qq) ||
        safeLower(r.structure).includes(qq) ||
        safeLower(r.product_name).includes(qq) ||
        safeLower(r.document_number).includes(qq);

      const matchesStatus = quoteStatus === "ALL" ? true : (r.status as QuoteStatus) === quoteStatus;
      return matchesQ && matchesStatus;
    });

    return sortRows(filtered, quoteSort);
  }, [rows, qQuotes, quoteStatus, quoteSort]);

  /* ================== OPEN/CLOSE MODALS ================== */
  function openCreateModal(type: BillingType) {
    setSelectedId(null);
    setPageError(null);
    setFormError(null);

    setForm({
      type,
      date: "",
      client_id: "",
      structure: "",
      product_id: "",
      nb_candidates: "",
      nb_days: "",
      amount_ht: "",
      amount_ttc: "",
      status: defaultStatusFor(type),
      document_number: "",
      urssaf_paid: false,
      urssaf_amount: "",
      payment_date: "",
    });

    setOpenCreate(true);
  }

  function closeCreateModal() {
    setOpenCreate(false);
    setFormError(null);
  }

  async function openEditModal(id: string) {
    setSelectedId(id);
    setPageError(null);
    setFormError(null);

    const r = rows.find((x) => x.id === id);
    if (!r) return;

    setForm({
      type: r.type,
      date: r.date ?? "",
      client_id: r.client_id ?? "",
      structure: r.structure ?? "",
      product_id: r.product_id ?? "",
      nb_candidates: r.nb_candidates === null || r.nb_candidates === undefined ? "" : String(r.nb_candidates),
      nb_days: r.nb_days === null || r.nb_days === undefined ? "" : String(r.nb_days),
      amount_ht: r.amount_ht === null || r.amount_ht === undefined ? "" : String(r.amount_ht),
      amount_ttc: r.amount_ttc === null || r.amount_ttc === undefined ? "" : String(r.amount_ttc),
      status: r.status ?? defaultStatusFor(r.type),
      document_number: r.document_number ?? "",
      urssaf_paid: !!r.urssaf_paid,
      urssaf_amount: r.urssaf_amount === null || r.urssaf_amount === undefined ? "" : String(r.urssaf_amount),
      payment_date: r.payment_date ?? "",
    });

    setOpenEdit(true);
  }

  function closeEditModal() {
    setOpenEdit(false);
    setFormError(null);
  }

  function openViewModal(id: string) {
    setSelectedId(id);
    setOpenView(true);
  }

  function closeViewModal() {
    setOpenView(false);
    setSelectedId(null);
  }

  /* ================== VALIDATION ================== */
  function validateForm() {
    if (!required(form.date)) return "Merci de renseigner la date.";
    if (!required(form.client_id)) return "Merci de renseigner le client (ou l’ajouter).";
    if (!required(form.product_id)) return "Merci de renseigner la formation (produit).";
    if (!required(form.amount_ttc)) return "Merci de renseigner le montant TTC.";

    const amountTtc = parseDecimal(form.amount_ttc);
    if (amountTtc === null) return "Montant TTC invalide.";

    const nbCand = parseIntSafe(form.nb_candidates);
    if (form.nb_candidates && nbCand === null) return "Nb candidats invalide.";

    const nbDays = parseIntSafe(form.nb_days);
    if (form.nb_days && nbDays === null) return "Nb jours invalide.";

    return null;
  }

  /* ================== CRUD ================== */
  async function saveCreate() {
    if (saving) return;
    setSaving(true);

    try {
      setFormError(null);

      const err = validateForm();
      if (err) {
        setFormError(err);
        return;
      }

      const amountTtc = parseDecimal(form.amount_ttc)!;
      const amountHt = parseDecimal(form.amount_ht);
      const nbCand = parseIntSafe(form.nb_candidates);
      const nbDays = parseIntSafe(form.nb_days);

      const isInv = form.type === "INVOICE";
      const urssafAmount = isInv ? (parseDecimal(form.urssaf_amount) ?? urssafAuto(amountTtc)) : null;

      const { data: orgId, error: orgErr } = await supabase.rpc("current_org_id");
      if (orgErr) {
        setFormError(orgErr.message);
        return;
      }

      const payload: Partial<BillingRow> = {
        org_id: orgId as string,
        type: form.type,
        date: form.date,
        client_id: form.client_id || null,
        structure: form.structure?.trim() ? form.structure.trim() : null,
        product_id: form.product_id || null,
        nb_candidates: nbCand,
        nb_days: nbDays,
        amount_ht: amountHt,
        amount_ttc: amountTtc,
        status: form.status,
        document_number: form.document_number?.trim() ? form.document_number.trim() : null,

        urssaf_paid: isInv ? !!form.urssaf_paid : null,
        urssaf_amount: isInv ? urssafAmount : null,
        payment_date: isInv ? (form.payment_date?.trim() ? form.payment_date.trim() : null) : null,
      };

      const { error } = await supabase.from(BILLING_TABLE).insert(payload);
      if (error) {
        setFormError(error.message);
        return;
      }

      closeCreateModal();
      await fetchBilling();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!selectedId) return;
    if (saving) return;

    setSaving(true);
    try {
      setFormError(null);

      const err = validateForm();
      if (err) {
        setFormError(err);
        return;
      }

      const amountTtc = parseDecimal(form.amount_ttc)!;
      const amountHt = parseDecimal(form.amount_ht);
      const nbCand = parseIntSafe(form.nb_candidates);
      const nbDays = parseIntSafe(form.nb_days);

      const isInv = form.type === "INVOICE";
      const urssafAmount = isInv ? (parseDecimal(form.urssaf_amount) ?? urssafAuto(amountTtc)) : null;

      const payload: Partial<BillingRow> = {
        type: form.type,
        date: form.date,
        client_id: form.client_id || null,
        structure: form.structure?.trim() ? form.structure.trim() : null,
        product_id: form.product_id || null,
        nb_candidates: nbCand,
        nb_days: nbDays,
        amount_ht: amountHt,
        amount_ttc: amountTtc,
        status: form.status,
        document_number: form.document_number?.trim() ? form.document_number.trim() : null,

        urssaf_paid: isInv ? !!form.urssaf_paid : null,
        urssaf_amount: isInv ? urssafAmount : null,
        payment_date: isInv ? (form.payment_date?.trim() ? form.payment_date.trim() : null) : null,
      };

      const { error } = await supabase.from(BILLING_TABLE).update(payload).eq("id", selectedId);
      if (error) {
        setFormError(error.message);
        return;
      }

      closeEditModal();
      await fetchBilling();
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string) {
    const ok = window.confirm("Supprimer ce document ?");
    if (!ok) return;

    setPageError(null);
    const { error } = await supabase.from(BILLING_TABLE).delete().eq("id", id);
    if (error) return setPageError(error.message);

    await fetchBilling();
  }

  async function toggleUrssafPaid(id: string, current: boolean | null) {
    setPageError(null);
    const next = !current;
    const { error } = await supabase.from(BILLING_TABLE).update({ urssaf_paid: next }).eq("id", id);
    if (error) return setPageError(error.message);

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, urssaf_paid: next } : r)));
  }

  async function markAsPaid(id: string) {
    const current = new Date().toISOString().slice(0, 10);
    const d = window.prompt("Date de paiement (YYYY-MM-DD) :", current);
    if (d === null) return;
    const date = d.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      window.alert("Format invalide. Exemple attendu : 2026-02-21");
      return;
    }

    setPageError(null);
    const { error } = await supabase.from(BILLING_TABLE).update({ status: "ENCAISSEE", payment_date: date }).eq("id", id);

    if (error) {
      setPageError(error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "ENCAISSEE", payment_date: date } : r)));
  }

  async function setStatus(id: string, status: BillingStatus) {
    setPageError(null);
    const { error } = await supabase.from(BILLING_TABLE).update({ status }).eq("id", id);
    if (error) return setPageError(error.message);

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  /* ================== CLIENT CREATE (mini) ================== */
  function openClientCreate() {
    setFormError(null);
    setClientCreateName("");
    setOpenCreateClient(true);
  }
  function closeClientCreate() {
    setOpenCreateClient(false);
  }

  async function saveClientCreate() {
    setFormError(null);

    if (!required(clientCreateName)) {
      setFormError("Merci de renseigner le nom du client.");
      return;
    }

    const { data: orgId, error: orgErr } = await supabase.rpc("current_org_id");
    if (orgErr) return setFormError(orgErr.message);

    const payload = { org_id: orgId as string, name: clientCreateName.trim() };

    const { data, error } = await supabase.from(CLIENTS_TABLE).insert(payload).select("id,name").single();
    if (error) return setFormError(error.message);

    const newClient = data as ClientRow;

    await fetchClients();
    setField("client_id", newClient.id);
    closeClientCreate();
  }

  /* ================== RENDER ================== */
  return (
    <div style={containerStyle}>
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
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.2 }}>Devis & Factures</div>
          <div style={{ opacity: 0.6, marginTop: 2 }}>Gestion de la facturation</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={softBtnStyle} onClick={() => openCreateModal("QUOTE")} type="button">
            + Nouveau devis
          </button>
          <button style={primaryBtnStyle} onClick={() => openCreateModal("INVOICE")} type="button">
            + Nouvelle facture
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpiGrid" style={kpiGridStyle}>
        <KpiCard
          title={`CA annuel ${kpi.nowYear}`}
          value={euro(kpi.caNow)}
          sub={`${kpi.prevYear} : ${euro(kpi.caPrev)}`}
          tone="green"
          icon="📈"
        />
        <KpiCard
          title="En attente de règlement"
          value={euro(kpi.pendingAmount)}
          sub={`${kpi.pendingCount} facture(s)`}
          tone="orange"
          icon="⏳"
        />
        <KpiCard title="URSSAF en attente" value={euro(kpi.urssafPending)} sub=" " tone="red" icon="🧾" />
        <KpiCard
          title="Devis sans suite"
          value={euro(kpi.quotesSansSuiteAmount)}
          sub={`${kpi.quotesSansSuiteCount} devis`}
          tone="blue"
          icon="🚫"
        />
        <KpiCard
          title="Devis non retenus"
          value={euro(kpi.quotesNonRetenusAmount)}
          sub={`${kpi.quotesNonRetenusCount} devis`}
          tone="red"
          icon="⛔"
        />
      </div>

      {/* ================== FACTURES ================== */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={sectionHeaderStyle}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Factures</div>

          <div style={{ display: "flex", gap: 8, position: "relative", alignItems: "center", flexWrap: "wrap" }}>
            <button
              ref={invColsBtnRef}
              style={softBtnStyle}
              type="button"
              onClick={() => setOpenCols((v) => (v === "INVOICE" ? null : "INVOICE"))}
            >
              ⚙ Colonnes
            </button>

            {openCols === "INVOICE" && (
              <div ref={invColsPopRef} style={popoverStyle}>
                <div style={{ fontWeight: 950, marginBottom: 10, opacity: 0.8 }}>Afficher</div>

                {(
                  [
                    ["date", "Date"],
                    ["client", "Client"],
                    ["structure", "Structure"],
                    ["product", "Formation"],
                    ["nb", "Nb"],
                    ["duration", "Durée (prod)"],
                    ["ttc", "TTC"],
                    ["status", "Statut"],
                    ["doc", "N° Facture"],
                    ["urssaf", "URSSAF"],
                    ["urssaf_amount", "Mt URSSAF"],
                    ["payment_date", "Date paiement"],
                    ["actions", "Actions"],
                  ] as Array<[keyof typeof invoiceCols, string]>
                ).map(([k, label]) => (
                  <label
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 10px",
                      borderRadius: 12,
                      fontWeight: 900,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span>{label}</span>
                    <input type="checkbox" checked={invoiceCols[k]} onChange={() => setInvoiceCols((c) => ({ ...c, [k]: !c[k] }))} />
                  </label>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    style={softBtnStyle}
                    type="button"
                    onClick={() =>
                      setInvoiceCols({
                        date: true,
                        client: true,
                        structure: true,
                        product: true,
                        nb: true,
                        duration: true,
                        ttc: true,
                        status: true,
                        doc: true,
                        urssaf: true,
                        urssaf_amount: true,
                        payment_date: true,
                        actions: true,
                      })
                    }
                  >
                    Reset
                  </button>
                  <button style={softBtnStyle} type="button" onClick={() => setOpenCols(null)}>
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
            <input
              style={searchInputStyle}
              placeholder="Rechercher une facture…"
              value={qInvoices}
              onChange={(e) => setQInvoices(e.target.value)}
            />
          </div>

          <select style={selectStyle} value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value as any)} title="Statut">
            <option value="ALL">Tous</option>
            <option value="A_FACTURER">À facturer</option>
            <option value="TRANSMISE">Transmise</option>
            <option value="RELANCEE">Relancée</option>
            <option value="ENCAISSEE">Encaissée</option>
          </select>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {invoiceCols.date && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => setInvoiceSort((s) => ({ key: "date", dir: s.key === "date" && s.dir === "asc" ? "desc" : "asc" }))}
                      style={thBtnStyle}
                    >
                      Date{sortArrow(invoiceSort, "date")}
                    </button>
                  </th>
                )}

                {invoiceCols.client && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceSort((s) => ({ key: "client_name", dir: s.key === "client_name" && s.dir === "asc" ? "desc" : "asc" }))
                      }
                      style={thBtnStyle}
                    >
                      Client{sortArrow(invoiceSort, "client_name")}
                    </button>
                  </th>
                )}

                {invoiceCols.structure && <th style={thStyle}>Structure</th>}
                {invoiceCols.product && <th style={thStyle}>Formation</th>}
                {invoiceCols.nb && <th style={{ ...thStyle, textAlign: "center" }}>Nb</th>}
                {invoiceCols.duration && <th style={{ ...thStyle, textAlign: "center" }}>Durée (prod)</th>}

                {invoiceCols.ttc && (
                  <th style={{ ...thStyle, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceSort((s) => ({ key: "amount_ttc", dir: s.key === "amount_ttc" && s.dir === "asc" ? "desc" : "asc" }))
                      }
                      style={thBtnStyle}
                    >
                      TTC{sortArrow(invoiceSort, "amount_ttc")}
                    </button>
                  </th>
                )}

                {invoiceCols.status && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => setInvoiceSort((s) => ({ key: "status", dir: s.key === "status" && s.dir === "asc" ? "desc" : "asc" }))}
                      style={thBtnStyle}
                    >
                      Statut{sortArrow(invoiceSort, "status")}
                    </button>
                  </th>
                )}

                {invoiceCols.doc && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setInvoiceSort((s) => ({
                          key: "document_number",
                          dir: s.key === "document_number" && s.dir === "asc" ? "desc" : "asc",
                        }))
                      }
                      style={thBtnStyle}
                    >
                      N° Facture{sortArrow(invoiceSort, "document_number")}
                    </button>
                  </th>
                )}

                {invoiceCols.urssaf && <th style={{ ...thStyle, textAlign: "center" }}>URSSAF</th>}
                {invoiceCols.urssaf_amount && <th style={{ ...thStyle, textAlign: "right" }}>Mt URSSAF</th>}
                {invoiceCols.payment_date && <th style={thStyle}>Date paiement</th>}
                {invoiceCols.actions && <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Chargement…
                  </td>
                </tr>
              ) : invoicesFiltered.length === 0 ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Aucune facture
                  </td>
                </tr>
              ) : (
                invoicesFiltered.map((r) => {
                  const prod = products.find((p) => p.id === r.product_id);
                  const dur = formatDurationFromHours(prod?.nb_hours ?? null);

                  return (
                    <tr key={r.id}>
                      {invoiceCols.date && <td style={tdStyle}>{toFrDate(r.date)}</td>}
                      {invoiceCols.client && <td style={tdStyleStrong}>{r.client_name ?? "—"}</td>}
                      {invoiceCols.structure && <td style={tdStyle}>{r.structure ?? "—"}</td>}
                      {invoiceCols.product && <td style={tdStyle}>{r.product_name ?? "—"}</td>}
                      {invoiceCols.nb && <td style={tdStyleCenter}>{r.nb_candidates ?? "—"}</td>}
                      {invoiceCols.duration && <td style={tdStyleCenter}>{dur}</td>}
                      {invoiceCols.ttc && <td style={tdStyleRight}>{euro(r.amount_ttc)}</td>}

                      {invoiceCols.status && (
                        <td style={tdStyle}>
                          <BillingStatusPill type="INVOICE" status={r.status as InvoiceStatus} />
                        </td>
                      )}

                      {invoiceCols.doc && <td style={{ ...tdStyle, whiteSpace: "normal" }}>{r.document_number ?? "—"}</td>}

                      {invoiceCols.urssaf && (
                        <td style={tdStyleCenter}>
                          <BoolPill
                            ok={!!r.urssaf_paid}
                            okLabel="✓"
                            koLabel="✕"
                            onToggle={() => void toggleUrssafPaid(r.id, !!r.urssaf_paid)}
                          />
                        </td>
                      )}

                      {invoiceCols.urssaf_amount && <td style={tdStyleRight}>{euro(r.urssaf_amount)}</td>}
                      {invoiceCols.payment_date && <td style={tdStyle}>{toFrDate(r.payment_date)}</td>}

                      {invoiceCols.actions && (
                        <td style={tdStyleCenter}>
                          <div style={{ display: "inline-flex", gap: 8, position: "relative" }}>
                            <button style={iconBtnStyle} onClick={() => openViewModal(r.id)} title="Voir" type="button">
                              👁
                            </button>
                            <button style={iconBtnStyle} onClick={() => void openEditModal(r.id)} title="Modifier" type="button">
                              ✎
                            </button>
                            <button style={iconBtnDangerStyle} onClick={() => void deleteRow(r.id)} title="Supprimer" type="button">
                              🗑
                            </button>

                            <button
                              style={iconBtnStyle}
                              onClick={() => setOpenMenuFor((v) => (v === r.id ? null : r.id))}
                              title="Changer statut"
                              type="button"
                            >
                              …
                            </button>

                            {openMenuFor === r.id && (
                              <div style={menuStyle} ref={menuRef}>
                                <MenuItem icon="✓" onClick={() => void markAsPaid(r.id)}>
                                  Marquer réglée
                                </MenuItem>
                                <MenuItem icon="✈" onClick={() => void setStatus(r.id, "TRANSMISE")}>
                                  Transmise
                                </MenuItem>
                                <MenuItem icon="⏰" onClick={() => void setStatus(r.id, "RELANCEE")}>
                                  Relancée
                                </MenuItem>
                              </div>
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

        {pageError && !openCreate && !openEdit && !openView && (
          <div style={{ padding: 12, color: "rgb(220,38,38)", fontWeight: 900 }}>{pageError}</div>
        )}
      </div>

      {/* ================== DEVIS ================== */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={sectionHeaderStyle}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Devis</div>

          <div style={{ display: "flex", gap: 8, position: "relative", alignItems: "center", flexWrap: "wrap" }}>
            <button
              ref={quoColsBtnRef}
              style={softBtnStyle}
              type="button"
              onClick={() => setOpenCols((v) => (v === "QUOTE" ? null : "QUOTE"))}
            >
              ⚙ Colonnes
            </button>

            {openCols === "QUOTE" && (
              <div ref={quoColsPopRef} style={popoverStyle}>
                <div style={{ fontWeight: 950, marginBottom: 10, opacity: 0.8 }}>Afficher</div>

                {(
                  [
                    ["date", "Date"],
                    ["client", "Client"],
                    ["structure", "Structure"],
                    ["product", "Formation"],
                    ["nb", "Nb"],
                    ["duration", "Durée (prod)"],
                    ["ttc", "TTC"],
                    ["status", "Statut"],
                    ["doc", "N° Devis"],
                    ["actions", "Actions"],
                  ] as Array<[keyof typeof quoteCols, string]>
                ).map(([k, label]) => (
                  <label
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 10px",
                      borderRadius: 12,
                      fontWeight: 900,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span>{label}</span>
                    <input type="checkbox" checked={quoteCols[k]} onChange={() => setQuoteCols((c) => ({ ...c, [k]: !c[k] }))} />
                  </label>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    style={softBtnStyle}
                    type="button"
                    onClick={() =>
                      setQuoteCols({
                        date: true,
                        client: true,
                        structure: true,
                        product: true,
                        nb: true,
                        duration: true,
                        ttc: true,
                        status: true,
                        doc: true,
                        actions: true,
                      })
                    }
                  >
                    Reset
                  </button>
                  <button style={softBtnStyle} type="button" onClick={() => setOpenCols(null)}>
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={filtersRowStyle}>
          <div style={searchWrapStyle}>
            <input
              style={searchInputStyle}
              placeholder="Rechercher un devis…"
              value={qQuotes}
              onChange={(e) => setQQuotes(e.target.value)}
            />
          </div>

          <select style={selectStyle} value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value as any)} title="Statut">
            <option value="ALL">Tous</option>
            <option value="EN_COURS">En cours</option>
            <option value="SANS_SUITE">Sans suite</option>
            <option value="NON_RETENU">Non retenu</option>
          </select>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {quoteCols.date && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => setQuoteSort((s) => ({ key: "date", dir: s.key === "date" && s.dir === "asc" ? "desc" : "asc" }))}
                      style={thBtnStyle}
                    >
                      Date{sortArrow(quoteSort, "date")}
                    </button>
                  </th>
                )}

                {quoteCols.client && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteSort((s) => ({ key: "client_name", dir: s.key === "client_name" && s.dir === "asc" ? "desc" : "asc" }))
                      }
                      style={thBtnStyle}
                    >
                      Client{sortArrow(quoteSort, "client_name")}
                    </button>
                  </th>
                )}

                {quoteCols.structure && <th style={thStyle}>Structure</th>}
                {quoteCols.product && <th style={thStyle}>Formation</th>}
                {quoteCols.nb && <th style={{ ...thStyle, textAlign: "center" }}>Nb</th>}
                {quoteCols.duration && <th style={{ ...thStyle, textAlign: "center" }}>Durée (prod)</th>}

                {quoteCols.ttc && (
                  <th style={{ ...thStyle, textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteSort((s) => ({ key: "amount_ttc", dir: s.key === "amount_ttc" && s.dir === "asc" ? "desc" : "asc" }))
                      }
                      style={thBtnStyle}
                    >
                      TTC{sortArrow(quoteSort, "amount_ttc")}
                    </button>
                  </th>
                )}

                {quoteCols.status && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => setQuoteSort((s) => ({ key: "status", dir: s.key === "status" && s.dir === "asc" ? "desc" : "asc" }))}
                      style={thBtnStyle}
                    >
                      Statut{sortArrow(quoteSort, "status")}
                    </button>
                  </th>
                )}

                {quoteCols.doc && (
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteSort((s) => ({
                          key: "document_number",
                          dir: s.key === "document_number" && s.dir === "asc" ? "desc" : "asc",
                        }))
                      }
                      style={thBtnStyle}
                    >
                      N° Devis{sortArrow(quoteSort, "document_number")}
                    </button>
                  </th>
                )}

                {quoteCols.actions && <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Chargement…
                  </td>
                </tr>
              ) : quotesFiltered.length === 0 ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Aucun devis
                  </td>
                </tr>
              ) : (
                quotesFiltered.map((r) => {
                  const prod = products.find((p) => p.id === r.product_id);
                  const dur = formatDurationFromHours(prod?.nb_hours ?? null);

                  return (
                    <tr key={r.id}>
                      {quoteCols.date && <td style={tdStyle}>{toFrDate(r.date)}</td>}
                      {quoteCols.client && <td style={tdStyleStrong}>{r.client_name ?? "—"}</td>}
                      {quoteCols.structure && <td style={tdStyle}>{r.structure ?? "—"}</td>}
                      {quoteCols.product && <td style={tdStyle}>{r.product_name ?? "—"}</td>}
                      {quoteCols.nb && <td style={tdStyleCenter}>{r.nb_candidates ?? "—"}</td>}
                      {quoteCols.duration && <td style={tdStyleCenter}>{dur}</td>}
                      {quoteCols.ttc && <td style={tdStyleRight}>{euro(r.amount_ttc)}</td>}

                      {quoteCols.status && (
                        <td style={tdStyle}>
                          <BillingStatusPill type="QUOTE" status={r.status as QuoteStatus} />
                        </td>
                      )}

                      {quoteCols.doc && <td style={{ ...tdStyle, whiteSpace: "normal" }}>{r.document_number ?? "—"}</td>}

                      {quoteCols.actions && (
                        <td style={tdStyleCenter}>
                          <div style={{ display: "inline-flex", gap: 8, position: "relative" }}>
                            <button style={iconBtnStyle} onClick={() => openViewModal(r.id)} title="Voir" type="button">
                              👁
                            </button>
                            <button style={iconBtnStyle} onClick={() => void openEditModal(r.id)} title="Modifier" type="button">
                              ✎
                            </button>
                            <button style={iconBtnDangerStyle} onClick={() => void deleteRow(r.id)} title="Supprimer" type="button">
                              🗑
                            </button>

                            <button
                              style={iconBtnStyle}
                              onClick={() => setOpenMenuFor((v) => (v === r.id ? null : r.id))}
                              title="Changer statut"
                              type="button"
                            >
                              …
                            </button>

                            {openMenuFor === r.id && (
                              <div style={menuStyle} ref={menuRef}>
                                <MenuItem icon="🟦" onClick={() => void setStatus(r.id, "EN_COURS")}>
                                  En cours
                                </MenuItem>
                                <MenuItem icon="🚫" onClick={() => void setStatus(r.id, "SANS_SUITE")}>
                                  Sans suite
                                </MenuItem>
                                <MenuItem icon="⛔" onClick={() => void setStatus(r.id, "NON_RETENU")}>
                                  Non retenu
                                </MenuItem>
                              </div>
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

        {pageError && !openCreate && !openEdit && !openView && (
          <div style={{ padding: 12, color: "rgb(220,38,38)", fontWeight: 900 }}>{pageError}</div>
        )}
      </div>

      {/* ================== VIEW MODAL ================== */}
      {openView && selected && (
        <div style={overlayStyle} onMouseDown={closeViewModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.2 }}>
                  Voir {selected.type === "INVOICE" ? "facture" : "devis"}
                </div>
                <div style={{ opacity: 0.65, fontWeight: 800, marginTop: 2 }}>
                  {selected.client_name ?? "—"} • {selected.product_name ?? "—"}
                </div>
              </div>

              <button style={softBtnStyle} onClick={closeViewModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <ViewCard label="Type" value={selected.type === "INVOICE" ? "Facture" : "Devis"} />
                <ViewCard label="Date" value={toFrDate(selected.date)} />
                <ViewCard label="Client" value={selected.client_name ?? "—"} />
                <ViewCard label="Structure" value={selected.structure ?? "—"} />
                <ViewCard label="Formation" value={selected.product_name ?? "—"} />
                <ViewCard label="Nb candidats" value={selected.nb_candidates?.toString() ?? "—"} />
                <ViewCard label="Nb jours" value={selected.nb_days?.toString() ?? "—"} />
                <ViewCard label="Montant HT" value={euro(selected.amount_ht)} />
                <ViewCard label="Montant TTC" value={euro(selected.amount_ttc)} />
                <ViewCard label="Statut" value={String(selected.status)} />
                <ViewCard label="N° document" value={selected.document_number ?? "—"} wide />

                {selected.type === "INVOICE" && (
                  <>
                    <ViewCard label="URSSAF payée" value={(selected.urssaf_paid ?? false) ? "Oui" : "Non"} />
                    <ViewCard label="Mt URSSAF" value={euro(selected.urssaf_amount)} />
                    <ViewCard label="Date paiement" value={toFrDate(selected.payment_date)} />
                  </>
                )}
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                style={softBtnStyle}
                onClick={() => {
                  const id = selectedId;
                  closeViewModal();
                  if (id) void openEditModal(id);
                }}
                type="button"
              >
                Modifier
              </button>

              <button style={primaryBtnStyle} onClick={closeViewModal} type="button">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================== CREATE MODAL ================== */}
      {openCreate && (
        <div style={overlayStyle} onMouseDown={closeCreateModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>
                Ajouter {form.type === "INVOICE" ? "une facture" : "un devis"}
              </div>
              <button style={softBtnStyle} onClick={closeCreateModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
<FormFields
  form={form}
  setField={setField as unknown as <K extends string>(key: K, value: any) => void}
  clients={clients}
  products={products}
  onAddClient={openClientCreate}
/>              {formError && <div style={inlineErrorStyle}>{formError}</div>}
            </div>

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

      {/* ================== EDIT MODAL ================== */}
      {openEdit && (
        <div style={overlayStyle} onMouseDown={closeEditModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Modifier {form.type === "INVOICE" ? "facture" : "devis"}</div>
              <button style={softBtnStyle} onClick={closeEditModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
<FormFields
  form={form}
  setField={setField as unknown as <K extends string>(key: K, value: any) => void}
  clients={clients}
  products={products}
  onAddClient={openClientCreate}
/>              {formError && <div style={inlineErrorStyle}>{formError}</div>}
            </div>

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

      {/* ================== CREATE CLIENT MODAL (mini) ================== */}
      {openCreateClient && (
        <div style={overlayStyle} onMouseDown={closeClientCreate}>
          <div style={{ ...modalStyle, width: "min(560px, 96vw)" }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Ajouter un client</div>
              <button style={softBtnStyle} onClick={closeClientCreate} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={labelStyle}>Nom du client *</div>
              <input
                style={searchInputStyle}
                value={clientCreateName}
                onChange={(e) => setClientCreateName(e.target.value)}
                placeholder="Ex: WOTAN"
              />
              {formError && <div style={inlineErrorStyle}>{formError}</div>}
            </div>

            <div style={modalFooterStyle}>
              <button style={softBtnStyle} onClick={closeClientCreate} type="button">
                Annuler
              </button>
              <button style={primaryBtnStyle} onClick={() => void saveClientCreate()} type="button">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== FORM FIELDS ================== */
function FormFields(props: {
  form: any;
  setField: <K extends string>(key: K, value: any) => void;
  clients: ClientRow[];
  products: ProductRow[];
  onAddClient: () => void;
}) {
  const { form, setField, clients, products, onAddClient } = props;
  const isInvoiceType = form.type === "INVOICE";

  useEffect(() => {
    if (!isInvoiceType) return;

    const ttc = parseDecimal(form.amount_ttc);
    if (ttc === null) {
      setField("urssaf_amount", "");
      return;
    }
    setField("urssaf_amount", urssafAuto(ttc).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount_ttc, form.type]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Type document *</div>
          <select
            style={selectStyle}
            value={form.type}
            onChange={(e) => {
              const next = e.target.value as BillingType;
              setField("type", next);
              setField("status", defaultStatusFor(next));

              if (next === "QUOTE") {
                setField("urssaf_paid", false);
                setField("urssaf_amount", "");
                setField("payment_date", "");
              }
            }}
          >
            <option value="INVOICE">Facture</option>
            <option value="QUOTE">Devis</option>
          </select>
        </div>

        <div>
          <div style={labelStyle}>Date d’émission *</div>
          <input type="date" style={searchInputStyle} value={form.date} onChange={(e) => setField("date", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Client *</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...selectStyle, flex: 1, minWidth: 220 }} value={form.client_id} onChange={(e) => setField("client_id", e.target.value)}>
              <option value="" disabled>
                Sélectionner…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button style={softBtnStyle} type="button" onClick={onAddClient} title="Ajouter un client">
              + Client
            </button>
          </div>
        </div>

        <div>
          <div style={labelStyle}>Structure (optionnel)</div>
          <input style={searchInputStyle} value={form.structure} onChange={(e) => setField("structure", e.target.value)} placeholder="Ex: Hyper U" />
        </div>
      </div>

      <div>
        <div style={labelStyle}>Formation (produit) *</div>
        <select
          style={selectStyle}
          value={form.product_id}
          onChange={(e) => {
            const id = e.target.value;
            setField("product_id", id);

            const p = products.find((x) => x.id === id);
            if (!p) return;

            const { days } = splitHoursToDays(p.nb_hours);
            setField("nb_days", String(days));
          }}
        >
          <option value="" disabled>
            Sélectionner…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.nb_hours ? `— ${formatDurationFromHours(p.nb_hours)}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Nb candidats</div>
          <input
            type="number"
            min={0}
            style={searchInputStyle}
            value={form.nb_candidates}
            onChange={(e) => setField("nb_candidates", e.target.value)}
            placeholder="Ex: 8"
          />
        </div>

        <div>
          <div style={labelStyle}>Nb jours</div>
          <input type="number" min={0} style={searchInputStyle} value={form.nb_days} onChange={(e) => setField("nb_days", e.target.value)} placeholder="Ex: 2" />
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65, fontWeight: 800 }}>
            (Auto depuis le produit — modifiable)
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={labelStyle}>Montant HT (optionnel)</div>
          <input style={searchInputStyle} value={form.amount_ht} onChange={(e) => setField("amount_ht", e.target.value)} placeholder="Ex: 1200" />
        </div>

        <div>
          <div style={labelStyle}>Montant TTC *</div>
          <input style={searchInputStyle} value={form.amount_ttc} onChange={(e) => setField("amount_ttc", e.target.value)} placeholder="Ex: 1440" />
          {isInvoiceType && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65, fontWeight: 800 }}>
              URSSAF auto: {URSSAF_RATE} × TTC
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={labelStyle}>{isInvoiceType ? "Statut facture" : "Statut devis"}</div>

        {isInvoiceType ? (
          <select style={selectStyle} value={form.status} onChange={(e) => setField("status", e.target.value)}>
            <option value="A_FACTURER">À facturer</option>
            <option value="TRANSMISE">Transmise</option>
            <option value="RELANCEE">Relancée</option>
            <option value="ENCAISSEE">Encaissée</option>
          </select>
        ) : (
          <select style={selectStyle} value={form.status} onChange={(e) => setField("status", e.target.value)}>
            <option value="EN_COURS">En cours</option>
            <option value="SANS_SUITE">Sans suite</option>
            <option value="NON_RETENU">Non retenu</option>
          </select>
        )}
      </div>

      <div>
        <div style={labelStyle}>N° document</div>
        <input
          style={searchInputStyle}
          value={form.document_number}
          onChange={(e) => setField("document_number", e.target.value)}
          placeholder={isInvoiceType ? "Ex: Facture 2026 01 31 WOTAN" : "Ex: Devis 2026 01 15 WOTAN"}
        />
      </div>

      {isInvoiceType && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>URSSAF payée</div>
              <select style={selectStyle} value={form.urssaf_paid ? "YES" : "NO"} onChange={(e) => setField("urssaf_paid", e.target.value === "YES")}>
                <option value="NO">Non</option>
                <option value="YES">Oui</option>
              </select>
            </div>

            <div>
              <div style={labelStyle}>Montant URSSAF</div>
              <input style={searchInputStyle} value={form.urssaf_amount} onChange={(e) => setField("urssaf_amount", e.target.value)} placeholder="Auto (0,27 × TTC)" />
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65, fontWeight: 800 }}>
                (Prérempli automatiquement — modifiable)
              </div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Date de paiement (optionnel)</div>
            <input type="date" style={searchInputStyle} value={form.payment_date} onChange={(e) => setField("payment_date", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== UI bits ================== */
function MenuItem(props: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15, 23, 42, 0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 18, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{props.icon}</span>
      <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{props.children}</span>
    </button>
  );
}

function BillingStatusPill(props: { type: BillingType; status: InvoiceStatus | QuoteStatus }) {
  const label =
    props.type === "INVOICE"
      ? ({
          A_FACTURER: "à facturer",
          TRANSMISE: "Transmise",
          RELANCEE: "Relancée",
          ENCAISSEE: "Perçue",
        } as any)[props.status] ?? String(props.status)
      : ({
          EN_COURS: "En cours",
          SANS_SUITE: "Sans suite",
          NON_RETENU: "Non retenu",
        } as any)[props.status] ?? String(props.status);

  const tone =
    props.status === "ENCAISSEE"
      ? "green"
      : props.status === "TRANSMISE"
        ? "blue"
        : props.status === "RELANCEE" || props.status === "A_FACTURER"
          ? "orange"
          : props.status === "SANS_SUITE" || props.status === "NON_RETENU"
            ? "red"
            : "blue";

  const bg =
    tone === "green"
      ? "rgba(34,197,94,0.12)"
      : tone === "orange"
        ? "rgba(245,158,11,0.14)"
        : tone === "red"
          ? "rgba(239,68,68,0.14)"
          : "rgba(59,130,246,0.14)";

  const fg =
    tone === "green"
      ? "rgb(22,163,74)"
      : tone === "orange"
        ? "rgb(217,119,6)"
        : tone === "red"
          ? "rgb(220,38,38)"
          : "rgb(37,99,235)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 950,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function BoolPill(props: { ok: boolean; okLabel: string; koLabel: string; onToggle?: () => void }) {
  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 999,
        background: props.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: props.ok ? "rgb(22,163,74)" : "rgb(220,38,38)",
        fontWeight: 950,
      }}
    >
      {props.ok ? props.okLabel : props.koLabel}
    </span>
  );

  if (!props.onToggle) return content;

  return (
    <button type="button" onClick={props.onToggle} title="Changer URSSAF (clic)" style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
      {content}
    </button>
  );
}

function ViewCard(props: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ gridColumn: props.wide ? "1 / -1" : undefined }}>
      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>{props.label}</div>
        <div style={{ marginTop: 6, fontWeight: 950 }}>{props.value}</div>
      </div>
    </div>
  );
}

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
          <div style={{ fontSize: 30, fontWeight: 980, letterSpacing: -0.4, marginTop: 8 }}>{props.value}</div>
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
