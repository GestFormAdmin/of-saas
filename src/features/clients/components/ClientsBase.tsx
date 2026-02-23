"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ClientRowActions from "./ClientRowActions";
import { usePermissions } from "@/features/auth/PermissionsProviderClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// ✅ AJOUT (guard)
import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
/* ================== STYLES (table) ================== */
const tableStyle: React.CSSProperties = {
  width: "100%",
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
  position: "sticky",
  top: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
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
const tdStyleRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
const tdStyleCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };

const badgeSortStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 12,
  opacity: 0.7,
  fontWeight: 900,
};

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: 260,
  background: "white",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 14,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  padding: 10,
  zIndex: 50,
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 8px",
  borderRadius: 10,
};

/* ================== TYPES ================== */
type Client = {
  id: string;
  org_id?: string;
  created_at?: string;

  name: string | null;
  email: string | null;
  phone: string | null;

  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;

  notes: string | null;
};

type ClientKpis = {
  client_id: string;
  learners_current_year: number;
  learners_total: number;
  cash_collected: number;
  cash_pending: number;
  quotes_lost: number;
};

/* ================== HELPERS ================== */
function formatMoneyEUR(value: number) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${value} €`;
  }
}

function ModalShell({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl border hover:bg-gray-50"
            aria-label="Fermer"
            title="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  tone,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  tone: "green" | "orange" | "red" | "blue" | "gray";
  icon: string;
}) {
  const tones: Record<string, { bg: string; badge: string }> = {
    green: { bg: "rgba(34,197,94,0.08)", badge: "rgb(34,197,94)" },
    orange: { bg: "rgba(249,115,22,0.10)", badge: "rgb(249,115,22)" },
    red: { bg: "rgba(239,68,68,0.10)", badge: "rgb(239,68,68)" },
    blue: { bg: "rgba(59,130,246,0.10)", badge: "rgb(59,130,246)" },
    gray: { bg: "rgba(15,23,42,0.06)", badge: "rgb(15,23,42)" },
  };

  const t = tones[tone];

  return (
    <div className="rounded-2xl border p-4" style={{ background: t.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>{title}</div>
          <div style={{ fontSize: 34, fontWeight: 950, marginTop: 6 }}>{value}</div>
          <div style={{ marginTop: 6, fontWeight: 900, opacity: 0.55, fontSize: 13 }}>{sub ?? " "}</div>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: t.badge,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 950,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ================== COMPONENT ================== */
export default function ClientsPageClient() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // ✅ AJOUT : permissions depuis le provider
const { allowedPages, isLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");
  const clientsFiltered = useMemo(() => {
    const qq = (q ?? "").trim().toLowerCase();
    if (!qq) return clients;

    return clients.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const city = (c.address_city ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      return name.includes(qq) || city.includes(qq) || email.includes(qq);
    });
  }, [clients, q]);

  // KPI read-only
  const [kpisByClientId, setKpisByClientId] = useState<Record<string, ClientKpis>>({});
  const [kpisPrevByClientId, setKpisPrevByClientId] = useState<Record<string, ClientKpis>>({});

  // selection + modals
  const [selected, setSelected] = useState<Client | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // form fields (create/edit)
  const [formName, setFormName] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formPostal, setFormPostal] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  // sorting + columns
  type SortKey =
    | "name"
    | "city"
    | "learners_current_year"
    | "learners_total"
    | "cash_collected"
    | "cash_pending"
    | "quotes_lost";

  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [colsOpen, setColsOpen] = useState(false);

  type ColKey =
    | "name"
    | "city"
    | "learners_current_year"
    | "learners_total"
    | "cash_collected"
    | "cash_pending"
    | "quotes_lost"
    | "actions";

  const COLS_STORAGE_KEY = "clients_table_cols_v1";

  const defaultVisibleCols: Record<ColKey, boolean> = {
    name: true,
    city: true,
    learners_current_year: true,
    learners_total: true,
    cash_collected: true,
    cash_pending: true,
    quotes_lost: true,
    actions: true,
  };

  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(defaultVisibleCols);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setVisibleCols((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(visibleCols));
    } catch {}
  }, [visibleCols]);

  async function loadOrgId() {
    const { data, error } = await supabase.rpc("current_org_id");
    console.log("[DEBUG] current_org_id =", data);
    if (error) throw error;

    const oid = (data as string) ?? null;
    if (!oid) throw new Error("Aucun organisme associé à ce compte.");
    return oid;
  }

  function kpisForYear(map: Record<string, ClientKpis>, clientId: string): ClientKpis {
    return (
      map[clientId] ?? {
        client_id: clientId,
        learners_current_year: 0,
        learners_total: 0,
        cash_collected: 0,
        cash_pending: 0,
        quotes_lost: 0,
      }
    );
  }

  async function fetchClients() {
    setLoading(true);
    setError(null);

    try {
      const oid = orgId ?? (await loadOrgId());
      setOrgId(oid);

      // STOP si pas d'org
      if (!oid) {
        setClients([]);
        setError("Aucun organisme associé à ce compte.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select(
          [
            "id",
            "org_id",
            "created_at",
            "name",
            "email",
            "phone",
            "address_street",
            "address_postal_code",
            "address_city",
            "notes",
          ].join(",")
        )
        .eq("org_id", oid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(((data as unknown) as Client[]) ?? []);

      try {
        const [{ data: kpiData, error: kpiErr }, { data: kpiPrevData, error: kpiPrevErr }] = await Promise.all([
          supabase.rpc("clients_kpis", { p_year: currentYear }),
          supabase.rpc("clients_kpis", { p_year: currentYear - 1 }),
        ]);

        if (!kpiErr && Array.isArray(kpiData)) {
          const map: Record<string, ClientKpis> = {};
          (kpiData as any[]).forEach((row) => {
            if (!row?.client_id) return;
            map[row.client_id] = {
              client_id: row.client_id,
              learners_current_year: Number(row.learners_current_year ?? 0),
              learners_total: Number(row.learners_total ?? 0),
              cash_collected: Number(row.cash_collected ?? 0),
              cash_pending: Number(row.cash_pending ?? 0),
              quotes_lost: Number(row.quotes_lost ?? 0),
            };
          });
          setKpisByClientId(map);
        } else {
          setKpisByClientId({});
        }

        if (!kpiPrevErr && Array.isArray(kpiPrevData)) {
          const mapPrev: Record<string, ClientKpis> = {};
          (kpiPrevData as any[]).forEach((row) => {
            if (!row?.client_id) return;
            mapPrev[row.client_id] = {
              client_id: row.client_id,
              learners_current_year: Number(row.learners_current_year ?? 0),
              learners_total: Number(row.learners_total ?? 0),
              cash_collected: Number(row.cash_collected ?? 0),
              cash_pending: Number(row.cash_pending ?? 0),
              quotes_lost: Number(row.quotes_lost ?? 0),
            };
          });
          setKpisPrevByClientId(mapPrev);
        } else {
          setKpisPrevByClientId({});
        }
      } catch {
        setKpisByClientId({});
        setKpisPrevByClientId({});
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillFormFromClient(c: Client) {
    setFormName(c.name ?? "");
    setFormStreet(c.address_street ?? "");
    setFormPostal(c.address_postal_code ?? "");
    setFormCity(c.address_city ?? "");
    setFormEmail(c.email ?? "");
    setFormPhone(c.phone ?? "");
    setFormNotes(c.notes ?? "");
  }

  function resetForm() {
    setFormName("");
    setFormStreet("");
    setFormPostal("");
    setFormCity("");
    setFormEmail("");
    setFormPhone("");
    setFormNotes("");
  }

  function openView(c: Client) {
    setSelected(c);
    setViewOpen(true);
  }

  function openEdit(c: Client) {
    setSelected(c);
    fillFormFromClient(c);
    setEditOpen(true);
  }

  function openCreate() {
    setSelected(null);
    resetForm();
    setCreateOpen(true);
  }

  async function deleteClient(c: Client) {
    const ok = window.confirm("Supprimer ce client ?");
    if (!ok) return;

    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) {
      setError(error.message);
      return;
    }
    await fetchClients();
  }

  async function saveEdit() {
    if (!selected) return;

    setSaving(true);

    const { error } = await supabase
      .from("clients")
      .update({
        name: formName.trim() || null,
        address_street: formStreet.trim() || null,
        address_postal_code: formPostal.trim() || null,
        address_city: formCity.trim() || null,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        notes: formNotes.trim() || null,
      })
      .eq("id", selected.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditOpen(false);
    setSelected(null);
    await fetchClients();
  }

  async function createClient() {
    setCreating(true);
    setError(null);

    try {
      const oid = orgId ?? (await loadOrgId());
      setOrgId(oid);

      if (!oid) {
        setCreating(false);
        setError("Aucun organisme associé à ce compte.");
        return;
      }

      const { error } = await supabase.from("clients").insert({
        org_id: oid,
        name: formName.trim() || null,
        address_street: formStreet.trim() || null,
        address_postal_code: formPostal.trim() || null,
        address_city: formCity.trim() || null,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        notes: formNotes.trim() || null,
      });

      setCreating(false);

      if (error) {
        setError(error.message);
        return;
      }

      setCreateOpen(false);
      resetForm();
      await fetchClients();
    } catch (e: any) {
      setCreating(false);
      setError(e?.message ?? "Erreur");
    }
  }

  const totals = clients.reduce(
    (acc, c) => {
      const k = kpisForYear(kpisByClientId, c.id);
      acc.learners_current_year += k.learners_current_year;
      acc.learners_total += k.learners_total;
      acc.cash_collected += k.cash_collected;
      acc.cash_pending += k.cash_pending;
      acc.quotes_lost += k.quotes_lost;
      return acc;
    },
    {
      learners_current_year: 0,
      learners_total: 0,
      cash_collected: 0,
      cash_pending: 0,
      quotes_lost: 0,
    }
  );

  const totalsPrev = clients.reduce(
    (acc, c) => {
      const k = kpisForYear(kpisPrevByClientId, c.id);
      acc.learners_current_year += k.learners_current_year;
      acc.learners_total += k.learners_total;
      acc.cash_collected += k.cash_collected;
      acc.cash_pending += k.cash_pending;
      acc.quotes_lost += k.quotes_lost;
      return acc;
    },
    {
      learners_current_year: 0,
      learners_total: 0,
      cash_collected: 0,
      cash_pending: 0,
      quotes_lost: 0,
    }
  );

  const columns = useMemo(() => {
    return [
      { key: "name" as const, label: "Nom", align: "left" as const, sortable: true },
      { key: "city" as const, label: "Ville", align: "left" as const, sortable: true },
      { key: "learners_current_year" as const, label: `Appr. ${currentYear}`, align: "right" as const, sortable: true },
      { key: "learners_total" as const, label: "Appr. total", align: "right" as const, sortable: true },
      { key: "cash_collected" as const, label: "CA encaissé", align: "right" as const, sortable: true },
      { key: "cash_pending" as const, label: "CA attente", align: "right" as const, sortable: true },
      { key: "quotes_lost" as const, label: "Devis sans suite", align: "right" as const, sortable: true },
      { key: "actions" as const, label: "Actions", align: "center" as const, sortable: false },
    ]
      .filter((c) => visibleCols[c.key as ColKey])
      .map((c) => c);
  }, [visibleCols, currentYear]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function sortBadge(k: SortKey) {
    if (sortKey !== k) return null;
    return <span style={badgeSortStyle}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  function getCellValueForSort(c: Client, k: SortKey) {
    const kpi = kpisForYear(kpisByClientId, c.id);

    switch (k) {
      case "name":
        return (c.name ?? "").toLowerCase();
      case "city":
        return (c.address_city ?? "").toLowerCase();
      case "learners_current_year":
        return kpi.learners_current_year;
      case "learners_total":
        return kpi.learners_total;
      case "cash_collected":
        return kpi.cash_collected;
      case "cash_pending":
        return kpi.cash_pending;
      case "quotes_lost":
        return kpi.quotes_lost;
    }
  }

  const clientsSorted = useMemo(() => {
    const arr = [...clientsFiltered];

    arr.sort((a, b) => {
      const va = getCellValueForSort(a, sortKey);
      const vb = getCellValueForSort(b, sortKey);

      if (typeof va === "string" || typeof vb === "string") {
        const sa = String(va);
        const sb = String(vb);
        const r = sa.localeCompare(sb, "fr", { sensitivity: "base" });
        return sortDir === "asc" ? r : -r;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      const r = na === nb ? 0 : na < nb ? -1 : 1;
      return sortDir === "asc" ? r : -r;
    });

    return arr;
  }, [clientsFiltered, sortKey, sortDir, kpisByClientId]);

  const showEmpty = !loading && clientsSorted.length === 0 && !error;

  // ✅ IMPORTANT : wrapper guard
  return (
<RequirePageAccessClient pageKey="clients" fallback={null}>      <div className="space-y-6">
        <PageHeader
          title="Clients"
          description="Gestion des clients" />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
            <div className="font-semibold">Erreur</div>
            <div className="text-muted-foreground">{error}</div>
          </div>
        ) : null}

        {/* KPI */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard title="Clients" value={`${clients.length}`} sub="Total clients" tone="gray" icon="👥" />
          <KpiCard
            title={`Apprenants ${currentYear}`}
            value={`${totals.learners_current_year}`}
            sub={`${currentYear - 1}: ${totalsPrev.learners_current_year}`}
            tone="blue"
            icon="🎓"
          />
          <KpiCard
            title="CA encaissé"
            value={formatMoneyEUR(totals.cash_collected)}
            sub={`${currentYear - 1}: ${formatMoneyEUR(totalsPrev.cash_collected)}`}
            tone="green"
            icon="€"
          />
          <KpiCard
            title="CA en attente"
            value={formatMoneyEUR(totals.cash_pending)}
            sub={`${currentYear - 1}: ${formatMoneyEUR(totalsPrev.cash_pending)}`}
            tone="orange"
            icon="⏱"
          />
          <KpiCard
            title="Devis sans suite"
            value={`${totals.quotes_lost}`}
            sub={`${currentYear - 1}: ${totalsPrev.quotes_lost}`}
            tone="red"
            icon="⛔"
          />
        </div>

        {/* LIST */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold">Liste des clients</div>

              <div className="flex flex-wrap items-center justify-between gap-3">
  <div className="text-lg font-semibold">Liste des clients</div>

  <div className="relative flex items-center gap-2">
    <Button variant="default" onClick={openCreate} disabled={loading}>
      + Ajouter un client
    </Button>

    <Button variant="secondary" onClick={() => void fetchClients()} disabled={loading}>
      Rafraîchir
    </Button>

    <Button variant="secondary" onClick={() => setColsOpen((v) => !v)}>
      Colonnes
    </Button>

    {colsOpen && (
      <div style={popoverStyle}>
        ...
      </div>
    )}
  </div>
</div>

                {colsOpen && (
                  <div style={popoverStyle}>
                    <div style={{ fontWeight: 950, padding: "6px 8px 8px 8px", opacity: 0.8 }}>Afficher</div>

                    {(
                      [
                        ["name", "Nom"],
                        ["city", "Ville"],
                        ["learners_current_year", `Appr. ${currentYear}`],
                        ["learners_total", "Appr. total"],
                        ["cash_collected", "CA encaissé"],
                        ["cash_pending", "CA attente"],
                        ["quotes_lost", "Devis sans suite"],
                        ["actions", "Actions"],
                      ] as Array<[ColKey, string]>
                    ).map(([k, label]) => (
                      <label
                        key={k}
                        style={{
                          ...checkboxRowStyle,
                          background: "rgba(15,23,42,0.02)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: 900 }}>{label}</span>
                        <input
                          type="checkbox"
                          checked={!!visibleCols[k]}
                          onChange={(e) => setVisibleCols((p) => ({ ...p, [k]: e.target.checked }))}
                        />
                      </label>
                    ))}

                    <div style={{ display: "flex", gap: 8, paddingTop: 10 }}>
                      <button
                        className="h-10 rounded-xl border px-3 font-semibold hover:bg-gray-50"
                        type="button"
                        onClick={() => setVisibleCols(defaultVisibleCols)}
                      >
                        Reset
                      </button>
                      <button
                        className="h-10 rounded-xl border px-3 font-semibold hover:bg-gray-50"
                        type="button"
                        onClick={() => setColsOpen(false)}
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none"
                placeholder="Rechercher un client… (nom, ville, email)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {showEmpty ? (
              <div className="mt-6">
                <EmptyState
                  title="Aucun client"
                  description="Crée ton premier client pour commencer." />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        {columns.map((col) => {
                          const isRight = col.align === "right";
                          const isCenter = col.align === "center";

                          const baseTh: React.CSSProperties = {
                            ...thStyle,
                            textAlign: isRight ? "right" : isCenter ? "center" : "left",
                            cursor: col.sortable && col.key !== "actions" ? "pointer" : "default",
                            userSelect: "none",
                          };

                          if (col.sortable && col.key !== "actions") {
                            return (
                              <th
                                key={col.key}
                                style={baseTh}
                                onClick={() => toggleSort(col.key as SortKey)}
                                title="Trier"
                              >
                                {col.label}
                                {sortBadge(col.key as SortKey)}
                              </th>
                            );
                          }

                          return (
                            <th key={col.key} style={baseTh}>
                              {col.label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={99} style={{ padding: 16, textAlign: "center", opacity: 0.65, fontWeight: 800 }}>
                            Chargement…
                          </td>
                        </tr>
                      ) : clientsSorted.length === 0 ? (
                        <tr>
                          <td colSpan={99} style={{ padding: 16, textAlign: "center", opacity: 0.65, fontWeight: 800 }}>
                            Aucun client
                          </td>
                        </tr>
                      ) : (
                        clientsSorted.map((c) => {
                          const k = kpisForYear(kpisByClientId, c.id);

                          return (
                            <tr key={c.id}>
                              {columns.map((col) => {
                                if (col.key === "name")
                                  return (
                                    <td key={col.key} style={tdStyleStrong}>
                                      {c.name ?? "—"}
                                    </td>
                                  );
                                if (col.key === "city")
                                  return (
                                    <td key={col.key} style={tdStyle}>
                                      {c.address_city ?? "—"}
                                    </td>
                                  );

                                if (col.key === "learners_current_year")
                                  return (
                                    <td key={col.key} style={tdStyleRight}>
                                      {k.learners_current_year}
                                    </td>
                                  );

                                if (col.key === "learners_total")
                                  return (
                                    <td key={col.key} style={tdStyleRight}>
                                      {k.learners_total}
                                    </td>
                                  );

                                if (col.key === "cash_collected")
                                  return (
                                    <td key={col.key} style={tdStyleRight}>
                                      {formatMoneyEUR(k.cash_collected)}
                                    </td>
                                  );

                                if (col.key === "cash_pending")
                                  return (
                                    <td key={col.key} style={tdStyleRight}>
                                      {formatMoneyEUR(k.cash_pending)}
                                    </td>
                                  );

                                if (col.key === "quotes_lost")
                                  return (
                                    <td key={col.key} style={tdStyleRight}>
                                      {k.quotes_lost}
                                    </td>
                                  );

                                return (
                                  <td key={col.key} style={tdStyleCenter}>
                                    <div style={{ display: "inline-flex", justifyContent: "center" }}>
                                      <ClientRowActions
                                        onView={() => openView(c)}
                                        onEdit={() => openEdit(c)}
                                        onDelete={() => void deleteClient(c)}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* CREATE */}
        <ModalShell title="Créer un client" open={createOpen} onClose={() => setCreateOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Nom</div>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Nom du client"
                />
              </div>

              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Rue</div>
                <input
                  value={formStreet}
                  onChange={(e) => setFormStreet(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Adresse"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Code postal</div>
                <input
                  value={formPostal}
                  onChange={(e) => setFormPostal(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="75000"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Ville</div>
                <input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Paris"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Email</div>
                <input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="email@domaine.com"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Téléphone</div>
                <input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="06..."
                />
              </div>

              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Notes</div>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="min-h-[140px] w-full rounded-xl border px-3 py-2"
                  placeholder="Notes internes…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Annuler
              </Button>
              <Button variant="default" onClick={() => void createClient()} disabled={creating}>
                {creating ? "Création..." : "Créer"}
              </Button>
            </div>
          </div>
        </ModalShell>

        {/* VIEW */}
        <ModalShell
          title="Voir le client"
          open={viewOpen && !!selected}
          onClose={() => {
            setViewOpen(false);
            setSelected(null);
          }}
        >
          {selected && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nom" value={selected.name ?? "-"} />
                <Field label="Email" value={selected.email ?? "-"} />
                <Field label="Téléphone" value={selected.phone ?? "-"} />
                <Field
                  label="Adresse"
                  value={
                    [selected.address_street, selected.address_postal_code, selected.address_city]
                      .filter(Boolean)
                      .join(", ") || "-"
                  }
                />
                <div className="col-span-2">
                  <Field label="Notes" value={selected.notes ?? "-"} />
                </div>
              </div>
            </div>
          )}
        </ModalShell>

        {/* EDIT */}
        <ModalShell
          title="Modifier le client"
          open={editOpen && !!selected}
          onClose={() => {
            setEditOpen(false);
            setSelected(null);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Nom</div>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Nom du client"
                />
              </div>

              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Rue</div>
                <input
                  value={formStreet}
                  onChange={(e) => setFormStreet(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Adresse"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Code postal</div>
                <input
                  value={formPostal}
                  onChange={(e) => setFormPostal(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="75000"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Ville</div>
                <input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="Paris"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Email</div>
                <input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="email@domaine.com"
                />
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-600">Téléphone</div>
                <input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-11 w-full rounded-xl border px-3"
                  placeholder="06..."
                />
              </div>

              <div className="col-span-2">
                <div className="mb-1 text-sm text-gray-600">Notes</div>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="min-h-[140px] w-full rounded-xl border px-3 py-2"
                  placeholder="Notes internes…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditOpen(false);
                  setSelected(null);
                }}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button variant="default" onClick={() => void saveEdit()} disabled={saving}>
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </ModalShell>
      </div>
</RequirePageAccessClient>
  );
}
