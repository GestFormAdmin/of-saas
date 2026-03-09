// ===== BLOCK 1/4 =====
// DepensesPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ================== TYPES ================== */
type Expense = {
  id: string;
  org_id: string;
  date: string; // YYYY-MM-DD
  designation: string;
  category: string;
  amount_ht: number | null;
  amount_ttc: number;
  structure: string | null;
  is_paid: boolean;
  justificatif_classe: boolean;
  year: number;
  created_at?: string;
  updated_at?: string;
};

type PaidFilter = "ALL" | "PAID" | "UNPAID";

type ColumnKey =
  | "date"
  | "designation"
  | "category"
  | "amount_ttc"
  | "amount_ht"
  | "structure"
  | "is_paid"
  | "justificatif_classe"
  | "year"
  | "actions";

type SortKey = Exclude<ColumnKey, "actions">;

type UiColumn = {
  key: ColumnKey;
  label: string;
  defaultOn: boolean;
  align?: "left" | "right" | "center";
};

/* ================== CATEGORIES ================== */
const DEFAULT_CATEGORIES = [
  "Carburant",
  "Hébergement",
  "Restauration",
  "Matériel informatique",
  "Matériel de formation",
  "Consommable formation",
  "Fournitures de bureaux",
  "Formations",
  "Trajet",
  "Frais Déclaratifs",
  "Frais Fixes",
] as const;

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

function euro(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
  } catch {
    return `${Number(n).toFixed(2)} €`;
  }
}

function parseDecimal(s: string) {
  const cleaned = String(s ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

/* ================== UI CONFIG ================== */
const COLUMNS: UiColumn[] = [
  { key: "date", label: "Date", defaultOn: true },
  { key: "designation", label: "Désignation", defaultOn: true },
  { key: "category", label: "Catégorie", defaultOn: true },
  { key: "amount_ttc", label: "TTC", defaultOn: true, align: "right" },
  { key: "amount_ht", label: "HT", defaultOn: false, align: "right" },
  { key: "structure", label: "Structure", defaultOn: true },
  { key: "is_paid", label: "Réglée", defaultOn: true, align: "center" },
  { key: "justificatif_classe", label: "Justificatif classé", defaultOn: true, align: "center" },
  { key: "year", label: "Année", defaultOn: false, align: "center" },
  { key: "actions", label: "Actions", defaultOn: true, align: "center" },
];

/* ================== PAGE ================== */
export default function DepensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<number | "ALL">("ALL");

  // columns
  const [openColumns, setOpenColumns] = useState(false);
  const [enabledCols, setEnabledCols] = useState<Record<ColumnKey, boolean>>(() => {
    const init: Record<ColumnKey, boolean> = {
      date: true,
      designation: true,
      category: true,
      amount_ttc: true,
      amount_ht: false,
      structure: true,
      is_paid: true,
      justificatif_classe: true,
      year: false,
      actions: true,
    };
    return init;
  });

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // modals
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  // form
  const [form, setForm] = useState({
    date: "",
    designation: "",
    category: "",
    amount_ht: "",
    amount_ttc: "",
    structure: "",
    is_paid: false,
    justificatif_classe: false,
  });

  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ================== FETCH ================== */
  useEffect(() => {
    void fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrgId() {
    const { data, error } = await supabase.rpc("current_org_id");
    if (error) throw error;

    const oid = (data as string) ?? null;
    if (!oid) throw new Error("Aucun organisme associé à ce compte.");
    return oid;
  }

  async function fetchExpenses() {
    setLoading(true);
    setError(null);

    try {
      const oid = orgId ?? (await loadOrgId());
      setOrgId(oid);

      if (!oid) {
        setRows([]);
        setError("Aucun organisme associé à ce compte.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("org_id", oid)
        .order("date", { ascending: false });

      if (error) throw error;

      setRows((data ?? []) as Expense[]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur chargement dépenses");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  /* ================== CATEGORIES / YEARS ================== */
  const categories = useMemo(() => {
    const fromDb = Array.from(new Set(rows.map((r) => (r.category ?? "").trim()).filter(Boolean)));
    const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...fromDb]));
    return merged.sort((a, b) => a.localeCompare(b, "fr"));
  }, [rows]);

  const years = useMemo(() => {
    const ys = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a);
    return ys;
  }, [rows]);

  const kpi = useMemo(() => {
    const year = new Date().getFullYear();
    const prevYear = year - 1;

    const scope = rows.filter((r) => r.year === year);
    const scopePrev = rows.filter((r) => r.year === prevYear);

    const total = scope.reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);
    const totalPrev = scopePrev.reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const paid = scope.filter((r) => r.is_paid).reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);
    const paidPrev = scopePrev
      .filter((r) => r.is_paid)
      .reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const unpaid = scope.filter((r) => !r.is_paid).reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);
    const unpaidPrev = scopePrev
      .filter((r) => !r.is_paid)
      .reduce((acc, r) => acc + (Number(r.amount_ttc) || 0), 0);

    const byCategory = new Map<string, number>();
    for (const r of scope) {
      const c = (r.category ?? "—").trim() || "—";
      byCategory.set(c, (byCategory.get(c) ?? 0) + (Number(r.amount_ttc) || 0));
    }

    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, sum]) => ({ name, sum }));

    return {
      year,
      prevYear,
      total,
      totalPrev,
      paid,
      paidPrev,
      unpaid,
      unpaidPrev,
      countYear: scope.length,
      countPrevYear: scopePrev.length,
      topCategories,
    };
  }, [rows]);

  /* ================== FILTER + SORT ================== */
  const filtered = useMemo(() => {
    const qq = safeLower(q.trim());

    return rows.filter((r) => {
      const matchesQ =
        !qq ||
        safeLower(r.designation).includes(qq) ||
        safeLower(r.category).includes(qq) ||
        safeLower(r.structure).includes(qq);

      const matchesPaid =
        paidFilter === "ALL" ? true : paidFilter === "PAID" ? r.is_paid === true : r.is_paid === false;

      const matchesYear = yearFilter === "ALL" ? true : r.year === yearFilter;

      return matchesQ && matchesPaid && matchesYear;
    });
  }, [rows, q, paidFilter, yearFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      const av: any = (a as any)[sortKey];
      const bv: any = (b as any)[sortKey];

      if (typeof av === "boolean" && typeof bv === "boolean") return (av === bv ? 0 : av ? 1 : -1) * dir;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

      if (av === null || av === undefined) return 1 * dir;
      if (bv === null || bv === undefined) return -1 * dir;

      if (sortKey === "date") return String(av).localeCompare(String(bv)) * dir;

      return String(av).localeCompare(String(bv), "fr", { sensitivity: "base", numeric: true }) * dir;
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(next: SortKey) {
    if (sortKey === next) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir(next === "date" ? "desc" : "asc");
    }
  }

  /* ================== CRUD ================== */
  async function togglePaid(row: Expense) {
    const next = !row.is_paid;
    const { error } = await supabase.from("expenses").update({ is_paid: next }).eq("id", row.id);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_paid: next } : r)));
  }

  async function toggleJustificatifClasse(row: Expense) {
    const next = !row.justificatif_classe;
    const { error } = await supabase.from("expenses").update({ justificatif_classe: next }).eq("id", row.id);
    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, justificatif_classe: next } : r)));
  }

  function openViewModal(id: string) {
    setSelectedId(id);
    setOpenView(true);
  }

  function closeViewModal() {
    setOpenView(false);
    setSelectedId(null);
  }

  function openCreateModal() {
    setSelectedId(null);
    setError(null);
    setForm({
      date: "",
      designation: "",
      category: "",
      amount_ht: "",
      amount_ttc: "",
      structure: "",
      is_paid: false,
      justificatif_classe: false,
    });
    setUseCustomCategory(false);
    setCustomCategory("");
    setOpenCreate(true);
  }

  function closeCreateModal() {
    setOpenCreate(false);
  }

  async function openEditModal(id: string) {
    setSelectedId(id);
    setError(null);

    const row = rows.find((r) => r.id === id);
    if (!row) return;

    setForm({
      date: row.date ?? "",
      designation: row.designation ?? "",
      category: row.category ?? "",
      amount_ht: row.amount_ht == null ? "" : String(row.amount_ht),
      amount_ttc: row.amount_ttc == null ? "" : String(row.amount_ttc),
      structure: row.structure ?? "",
      is_paid: !!row.is_paid,
      justificatif_classe: !!row.justificatif_classe,
    });

    const inList = categories.includes(row.category ?? "");
    setUseCustomCategory(!inList && !!row.category);
    setCustomCategory(!inList && row.category ? row.category : "");
    setOpenEdit(true);
  }

  function closeEditModal() {
    setOpenEdit(false);
  }
  // ===== BLOCK 2/4 =====
  async function saveCreate() {
    setError(null);

    if (!required(form.date) || !required(form.designation) || !required(form.category) || !required(form.amount_ttc)) {
      setError("Merci de renseigner Date, Désignation, Catégorie et Montant TTC.");
      return;
    }

    const amountTtc = parseDecimal(form.amount_ttc);
    const amountHt = parseDecimal(form.amount_ht);
    if (amountTtc === null) return setError("Montant TTC invalide.");

    const oid = orgId ?? (await loadOrgId());
    setOrgId(oid);

    if (!oid) return setError("Aucun organisme associé à ce compte.");

    const payload = {
      org_id: oid,
      date: form.date,
      designation: form.designation.trim(),
      category: form.category.trim(),
      amount_ht: amountHt,
      amount_ttc: amountTtc,
      structure: form.structure?.trim() ? form.structure.trim() : null,
      is_paid: !!form.is_paid,
      justificatif_classe: !!form.justificatif_classe,
    };

    const { error } = await supabase.from("expenses").insert(payload);
    if (error) return setError(error.message);

    closeCreateModal();
    await fetchExpenses();
  }

  async function saveEdit() {
    if (!selectedId) return;

    setError(null);

    if (!required(form.date) || !required(form.designation) || !required(form.category) || !required(form.amount_ttc)) {
      setError("Merci de renseigner Date, Désignation, Catégorie et Montant TTC.");
      return;
    }

    const amountTtc = parseDecimal(form.amount_ttc);
    const amountHt = parseDecimal(form.amount_ht);
    if (amountTtc === null) return setError("Montant TTC invalide.");

    const payload = {
      date: form.date,
      designation: form.designation.trim(),
      category: form.category.trim(),
      amount_ht: amountHt,
      amount_ttc: amountTtc,
      structure: form.structure?.trim() ? form.structure.trim() : null,
      is_paid: !!form.is_paid,
      justificatif_classe: !!form.justificatif_classe,
    };

    const { error } = await supabase.from("expenses").update(payload).eq("id", selectedId);
    if (error) return setError(error.message);

    closeEditModal();
    await fetchExpenses();
  }

  async function deleteExpense(id: string) {
    const ok = window.confirm("Supprimer cette dépense ?");
    if (!ok) return;

    setError(null);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return setError(error.message);

    await fetchExpenses();
  }

  /* ================== CATEGORY FIELD ================== */
  const CategoryField = (
    <div>
      <div style={labelStyle}>Catégorie *</div>

      {!useCustomCategory ? (
        <select
          style={selectStyle}
          value={form.category}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setUseCustomCategory(true);
              setCustomCategory("");
              setField("category", "");
            } else {
              setField("category", v);
            }
          }}
        >
          <option value="" disabled>
            Sélectionner…
          </option>

          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}

          <option value="__custom__">+ Ajouter une catégorie…</option>
        </select>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Nouvelle catégorie…"
            value={customCategory}
            onChange={(e) => {
              const v = e.target.value;
              setCustomCategory(v);
              setField("category", v);
            }}
          />
          <button
            type="button"
            style={softBtnStyle}
            onClick={() => {
              setUseCustomCategory(false);
              setCustomCategory("");
              setField("category", "");
            }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );

  /* ================== RENDER ================== */
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerRowStyle}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.2 }}>Dépenses</div>
          <div style={{ opacity: 0.6, marginTop: 2 }}>Suivi des dépenses et frais</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={softBtnTop} onClick={() => void fetchExpenses()} disabled={loading} type="button">
            Rafraîchir
          </button>
          <button style={primaryBtnTop} onClick={openCreateModal} type="button">
            + Nouvelle dépense
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpiGrid" style={kpiGridStyle}>
        <KpiCard
          title={`Total ${kpi.year}`}
          value={euro(kpi.total)}
          sub={`${kpi.prevYear} : ${euro(kpi.totalPrev)}`}
          tone="green"
          icon="💶"
        />
        <KpiCard
          title={`Réglées ${kpi.year}`}
          value={euro(kpi.paid)}
          sub={`${kpi.prevYear} : ${euro(kpi.paidPrev)}`}
          tone="blue"
          icon="✅"
        />
        <KpiCard
          title={`Non réglées ${kpi.year}`}
          value={euro(kpi.unpaid)}
          sub={`${kpi.prevYear} : ${euro(kpi.unpaidPrev)}`}
          tone="orange"
          icon="⏳"
        />
        <KpiCard
          title="Dépenses"
          value={`${kpi.countYear}`}
          sub={`${kpi.prevYear} : ${kpi.countPrevYear}`}
          tone="red"
          icon="🧾"
        />
        <KpiCard
          title="Top 3 catégories"
          value={kpi.topCategories?.[0]?.name ?? "—"}
          sub={
            kpi.topCategories.length ? (
              <div style={{ display: "grid", gap: 3, fontSize: 12, lineHeight: 1.15 }}>
                {kpi.topCategories.map((c, i) => (
                  <div key={`${c.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: 900, opacity: 0.85 }}>
                      {i + 1}. {c.name}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85, fontWeight: 900 }}>
                      {euro(c.sum)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              " "
            )
          }
          tone="gray"
          icon="🏷️"
        />
      </div>

      {/* Table Card */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={sectionHeaderStyle}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Liste des dépenses</div>

          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <button style={softBtnStyle} type="button" onClick={() => setOpenColumns((v) => !v)}>
              ⚙ Colonnes
            </button>
          </div>
        </div>

        <div style={filtersRowStyle}>
          <div style={searchWrapStyle}>
            <input style={searchInputStyle} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <select style={selectStyle} value={paidFilter} onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}>
            <option value="ALL">Tous</option>
            <option value="PAID">Réglées</option>
            <option value="UNPAID">Non réglées</option>
          </select>

          <select
            style={selectStyle}
            value={yearFilter === "ALL" ? "ALL" : String(yearFilter)}
            onChange={(e) => setYearFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
          >
            <option value="ALL">Toutes années</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          <div style={{ position: "relative" }}>
            <button style={softBtnStyle} onClick={() => setOpenColumns((v) => !v)} type="button">
              Colonnes
            </button>

            {openColumns && (
              <div style={columnsPopoverStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Afficher</div>

                {COLUMNS.filter((c) => c.key !== "actions").map((c) => (
                  <label key={c.key} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={enabledCols[c.key]}
                      onChange={(e) => setEnabledCols((p) => ({ ...p, [c.key]: e.target.checked }))}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button
                    style={softBtnStyle}
                    type="button"
                    onClick={() => {
                      const next: Record<ColumnKey, boolean> = {
                        date: true,
                        designation: true,
                        category: true,
                        amount_ttc: true,
                        amount_ht: false,
                        structure: true,
                        is_paid: true,
                        justificatif_classe: true,
                        year: false,
                        actions: true,
                      };
                      setEnabledCols(next);
                    }}
                  >
                    Reset
                  </button>
                  <button style={primaryBtnStyle} type="button" onClick={() => setOpenColumns(false)}>
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      
      
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {enabledCols.date && (
                  <Th onClick={() => toggleSort("date")} align="left">
                    Date {sortKey === "date" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.designation && (
                  <Th onClick={() => toggleSort("designation")} align="left">
                    Désignation {sortKey === "designation" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.category && (
                  <Th onClick={() => toggleSort("category")} align="left">
                    Catégorie {sortKey === "category" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.amount_ttc && (
                  <Th onClick={() => toggleSort("amount_ttc")} align="right">
                    TTC {sortKey === "amount_ttc" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.amount_ht && (
                  <Th onClick={() => toggleSort("amount_ht")} align="right">
                    HT {sortKey === "amount_ht" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.structure && (
                  <Th onClick={() => toggleSort("structure")} align="left">
                    Structure {sortKey === "structure" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.is_paid && (
                  <Th onClick={() => toggleSort("is_paid")} align="center">
                    Réglée {sortKey === "is_paid" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.justificatif_classe && (
                  <Th onClick={() => toggleSort("justificatif_classe")} align="center">
                    Justificatif classé {sortKey === "justificatif_classe" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                {enabledCols.year && (
                  <Th onClick={() => toggleSort("year")} align="center">
                    Année {sortKey === "year" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                )}
                <Th align="center">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Chargement…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={99} style={emptyStyle}>
                    Aucune dépense
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} style={trStyle}>
                    {enabledCols.date && <td style={tdStyle}>{toFrDate(r.date)}</td>}
                    {enabledCols.designation && <td style={tdStyleStrong}>{r.designation}</td>}
                    {enabledCols.category && <td style={tdStyle}>{r.category}</td>}
                    {enabledCols.amount_ttc && <td style={tdStyleRight}>{euro(r.amount_ttc)}</td>}
                    {enabledCols.amount_ht && <td style={tdStyleRight}>{euro(r.amount_ht)}</td>}
                    {enabledCols.structure && <td style={tdStyle}>{r.structure ?? "—"}</td>}
                    {enabledCols.is_paid && (
                      <td
                        style={tdStyleCenterClickable}
                        onClick={() => void togglePaid(r)}
                        title="Cliquer pour basculer"
                      >
                        <PaidPill ok={r.is_paid} yesTitle="Réglée" noTitle="Non réglée" />
                      </td>
                    )}
                    {enabledCols.justificatif_classe && (
                      <td
                        style={tdStyleCenterClickable}
                        onClick={() => void toggleJustificatifClasse(r)}
                        title="Cliquer pour basculer"
                      >
                        <PaidPill
                          ok={r.justificatif_classe}
                          yesTitle="Justificatif classé"
                          noTitle="Justificatif non classé"
                        />
                      </td>
                    )}
                    {enabledCols.year && <td style={tdStyleCenter}>{String(r.year)}</td>}

                    <td style={tdStyleCenter}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button style={iconBtnStyle} onClick={() => openViewModal(r.id)} title="Voir" type="button">
                          👁
                        </button>
                        <button
                          style={iconBtnStyle}
                          onClick={() => void openEditModal(r.id)}
                          title="Modifier"
                          type="button"
                        >
                          ✎
                        </button>
                        <button
                          style={iconBtnDangerStyle}
                          onClick={() => void deleteExpense(r.id)}
                          title="Supprimer"
                          type="button"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error && <div style={{ padding: 12, color: "rgb(220,38,38)", fontWeight: 900 }}>{error}</div>}
      </div>

      {/* VIEW MODAL */}
      {openView && selected && (
        <div style={overlayStyle} onMouseDown={closeViewModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Voir dépense</div>
              <button style={softBtnStyle} onClick={closeViewModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Info label="Date" value={toFrDate(selected.date)} />
                <Info label="Catégorie" value={selected.category ?? "—"} />
                <Info label="Désignation" value={selected.designation ?? "—"} wide />
                <Info label="Montant HT" value={euro(selected.amount_ht)} />
                <Info label="Montant TTC" value={euro(selected.amount_ttc)} />
                <Info label="Structure" value={selected.structure ?? "—"} wide />
                <Info label="Réglée" value={selected.is_paid ? "Oui" : "Non"} />
                <Info
                  label="Justificatif classé"
                  value={selected.justificatif_classe ? "Oui" : "Non"}
                />
                <Info label="Année" value={String(selected.year)} />
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                style={softBtnStyle}
                type="button"
                onClick={() => {
                  const id = selectedId;
                  closeViewModal();
                  if (id) void openEditModal(id);
                }}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {openCreate && (
        <div style={overlayStyle} onMouseDown={closeCreateModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Créer une dépense</div>
              <button style={softBtnStyle} onClick={closeCreateModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Date *</div>
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.date}
                      onChange={(e) => setField("date", e.target.value)}
                    />
                  </div>
                  {CategoryField}
                </div>

                <div>
                  <div style={labelStyle}>Désignation *</div>
                  <input
                    style={inputStyle}
                    value={form.designation}
                    onChange={(e) => setField("designation", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Montant HT</div>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.amount_ht}
                      onChange={(e) => setField("amount_ht", e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Montant TTC *</div>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.amount_ttc}
                      onChange={(e) => setField("amount_ttc", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Structure</div>
                  <input
                    style={inputStyle}
                    value={form.structure}
                    onChange={(e) => setField("structure", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.is_paid}
                      onChange={(e) => setField("is_paid", e.target.checked)}
                    />
                    <span style={{ fontWeight: 900 }}>Réglée</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.justificatif_classe}
                      onChange={(e) => setField("justificatif_classe", e.target.checked)}
                    />
                    <span style={{ fontWeight: 900 }}>Justificatif classé</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button style={softBtnStyle} onClick={closeCreateModal} type="button">
                Annuler
              </button>
              <button style={primaryBtnStyle} onClick={() => void saveCreate()} type="button">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
  
  
      {/* EDIT MODAL */}
      {openEdit && (
        <div style={overlayStyle} onMouseDown={closeEditModal}>
          <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Modifier dépense</div>
              <button style={softBtnStyle} onClick={closeEditModal} type="button">
                Fermer
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Date *</div>
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.date}
                      onChange={(e) => setField("date", e.target.value)}
                    />
                  </div>
                  {CategoryField}
                </div>

                <div>
                  <div style={labelStyle}>Désignation *</div>
                  <input
                    style={inputStyle}
                    value={form.designation}
                    onChange={(e) => setField("designation", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={labelStyle}>Montant HT</div>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.amount_ht}
                      onChange={(e) => setField("amount_ht", e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Montant TTC *</div>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.amount_ttc}
                      onChange={(e) => setField("amount_ttc", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Structure</div>
                  <input
                    style={inputStyle}
                    value={form.structure}
                    onChange={(e) => setField("structure", e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.is_paid}
                      onChange={(e) => setField("is_paid", e.target.checked)}
                    />
                    <span style={{ fontWeight: 900 }}>Réglée</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.justificatif_classe}
                      onChange={(e) => setField("justificatif_classe", e.target.checked)}
                    />
                    <span style={{ fontWeight: 900 }}>Justificatif classé</span>
                  </label>
                </div>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button style={softBtnStyle} onClick={closeEditModal} type="button">
                Annuler
              </button>
              <button style={primaryBtnStyle} onClick={() => void saveEdit()} type="button">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* responsive KPI */}
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
    </div>
  );
}

/* ================== SMALL UI ================== */
function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 900 }}>{label}</div>
      <div style={{ fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function Th(props: { children: React.ReactNode; onClick?: () => void; align?: "left" | "center" | "right" }) {
  return (
    <th
      onClick={props.onClick}
      style={{
        ...thStyle,
        cursor: props.onClick ? "pointer" : "default",
        textAlign: props.align ?? "left",
        userSelect: "none",
      }}
    >
      {props.children}
    </th>
  );
}

function PaidPill({
  ok,
  yesTitle = "Oui",
  noTitle = "Non",
}: {
  ok: boolean;
  yesTitle?: string;
  noTitle?: string;
}) {
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 950,
        fontSize: 14,
        background: ok ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
        color: ok ? "rgb(22,163,74)" : "rgb(220,38,38)",
        userSelect: "none",
      }}
      title={ok ? yesTitle : noTitle}
    >
      {ok ? "✓" : "✕"}
    </span>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  sub?: React.ReactNode;
  tone: "green" | "orange" | "red" | "blue" | "gray";
  icon: string;
}) {
  const toneMap: Record<string, { bg: string; icBg: string }> = {
    green: { bg: "rgba(34,197,94,0.08)", icBg: "rgba(34,197,94,1)" },
    orange: { bg: "rgba(245,158,11,0.10)", icBg: "rgba(245,158,11,1)" },
    red: { bg: "rgba(239,68,68,0.10)", icBg: "rgba(239,68,68,1)" },
    blue: { bg: "rgba(59,130,246,0.10)", icBg: "rgba(59,130,246,1)" },
    gray: { bg: "rgba(15,23,42,0.06)", icBg: "rgb(15,23,42)" },
  };
  const t = toneMap[props.tone];

  return (
    <div style={{ ...cardStyleBase, padding: 14, background: t.bg }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.7 }}>{props.title}</div>
          <div style={{ fontSize: 30, fontWeight: 980, letterSpacing: -0.5, marginTop: 8 }}>{props.value}</div>
          <div
            style={{
              marginTop: 6,
              opacity: 0.65,
              fontWeight: 800,
              fontSize: 11,
              lineHeight: 1.2,
            }}
          >
            {props.sub ?? " "}
          </div>
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

/* ================== STYLES ================== */
const containerStyle: React.CSSProperties = { width: "100%", maxWidth: 1200, margin: "0 auto", padding: 18 };

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

const cardStyleBase: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.10)",
  borderRadius: 14,
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.10)",
  borderRadius: 14,
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
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
  fontWeight: 800,
};

const selectStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  outline: "none",
  background: "white",
  fontWeight: 900,
};

const softBtnTop: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtnTop: React.CSSProperties = {
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

const tableStyle: React.CSSProperties = { width: "100%", minWidth: 1120, borderCollapse: "separate", borderSpacing: 0 };

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

const trStyle: React.CSSProperties = { borderTop: "1px solid rgba(15, 23, 42, 0.08)" };

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 750,
  borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const tdStyleStrong: React.CSSProperties = { ...tdStyle, fontWeight: 950 };
const tdStyleRight: React.CSSProperties = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdStyleCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };
const tdStyleCenterClickable: React.CSSProperties = { ...tdStyleCenter, cursor: "pointer" };

const emptyStyle: React.CSSProperties = { padding: 16, textAlign: "center", opacity: 0.65, fontWeight: 900 };

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  outline: "none",
  fontWeight: 800,
};

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 };

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

const softBtnStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
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
  width: "min(720px, 96vw)",
  maxHeight: "min(76vh, 720px)",
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
  maxHeight: "calc(min(76vh, 720px) - 120px)",
};

const modalFooterStyle: React.CSSProperties = {
  padding: 14,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  borderTop: "1px solid rgba(15, 23, 42, 0.08)",
};

const columnsPopoverStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: 44,
  width: 260,
  background: "#fff",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,.06)",
  boxShadow: "0 20px 60px rgba(0,0,0,.12)",
  padding: 12,
  zIndex: 10,
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 6px",
  cursor: "pointer",
};