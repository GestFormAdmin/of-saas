// src/features/sessions/components/SessionsPageClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CreateSessionModal from "./CreateSessionModal";
import { usePermissions } from "@/features/auth/PermissionsProviderClient";

type SessionRow = {
  id: string;
  org_id?: string;

  product_id?: string | null;
  client_id?: string | null;

  name: string | null;
  delivery_type?: "direct" | "subcontract" | "sous_traitee" | null;

  start_date: string | null;
  end_date: string | null;
  certification_date?: string | null;

  location_structure?: string | null;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;

  client_name?: string | null;
  product_name?: string | null;
};

type CreatedSessionPayload = {
  id: string;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  product_id: string | null;
};

type ColumnKey =
  | "name"
  | "client_name"
  | "product_name"
  | "start_date"
  | "end_date"
  | "certification_date"
  | "delivery_type";

type SortState = { key: ColumnKey; dir: "asc" | "desc" };

const STORAGE_KEY = "sessions_table_columns_v1";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Session" },
  { key: "client_name", label: "Client" },
  { key: "product_name", label: "Produit" },
  { key: "start_date", label: "Début" },
  { key: "end_date", label: "Fin" },
  { key: "certification_date", label: "Certif" },
  { key: "delivery_type", label: "Type" },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return d;
  }
}

function compare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const as = typeof a === "string" ? a : String(a);
  const bs = typeof b === "string" ? b : String(b);

  const at = Date.parse(as);
  const bt = Date.parse(bs);
  const aIsDate = !Number.isNaN(at);
  const bIsDate = !Number.isNaN(bt);
  if (aIsDate && bIsDate) return at - bt;

  return as.localeCompare(bs, "fr", { sensitivity: "base" });
}

function deliveryLabel(v?: "direct" | "subcontract" | "sous_traitee" | null) {
  if (v === "direct") return "Client direct";
  if (v === "subcontract") return "Sous-traitance";
  if (v === "sous_traitee") return "Sous-traitée";
  return "—";
}

function daysInclusive(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

function KpiCard(props: {
  title: string;
  year: number;
  value: number;
  prevYear: number;
  prevValue: number;
}) {
  return (
    <div className="rounded-2xl border p-6">
      <div className="text-lg font-semibold">
        {props.title} ({props.year})
      </div>

      <div className="mt-3 text-4xl font-bold">{props.value}</div>

      <div className="mt-3 text-lg font-semibold text-muted-foreground">
        {props.prevYear} : {props.prevValue}
      </div>
    </div>
  );
}

type SessionApprenantRow = {
  id: string;
  last_name: string | null;
  first_name: string | null;
  birth_date: string | null;
  candidate_validated: boolean | null;
};

export default function SessionsPageClient() {
  const router = useRouter();
 // ✅ Remplace UNIQUEMENT ce bloc dans ton TSX (dans SessionsPage / SessionsPageClient)
// (ne touche à rien d'autre)

const { allowedPages, isLoading } = usePermissions() as any;

const [orgId, setOrgId] = useState<string | null>(null);
const [orgLoading, setOrgLoading] = useState(true);

useEffect(() => {
  let alive = true;
  (async () => {
    setOrgLoading(true);
    const { data, error } = await supabase.rpc("current_org_id");
    if (!alive) return;
    if (error) {
      setOrgId(null);
      setOrgLoading(false);
      return;
    }
    setOrgId((data as string) ?? null);
    setOrgLoading(false);
  })();
  return () => {
    alive = false;
  };
}, []);

const isOF = !orgLoading && !!orgId;

const canCreate =
  isOF &&
  !isLoading &&
  Array.isArray(allowedPages) &&
  allowedPages.includes("sessions:create");


  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortState>({
    key: "start_date",
    dir: "desc",
  });

  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const base = Object.fromEntries(
      ALL_COLUMNS.map((c) => [c.key, true])
    ) as Record<ColumnKey, boolean>;

    if (typeof window === "undefined") return base;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
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

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);

  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCertif, setEditCertif] = useState("");
  const [editDelivery, setEditDelivery] = useState<"direct" | "subcontract" | "sous_traitee">("direct");

  const [editLocStructure, setEditLocStructure] = useState("");
  const [editLocStreet, setEditLocStreet] = useState("");
  const [editLocPostal, setEditLocPostal] = useState("");
  const [editLocCity, setEditLocCity] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<SessionRow | null>(null);

  const [sessionApprenants, setSessionApprenants] = useState<SessionApprenantRow[]>([]);
  const [sessionApprenantsLoading, setSessionApprenantsLoading] = useState(false);
  const [sessionApprenantsError, setSessionApprenantsError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);

    const { data: rpcOrgId, error: e0 } = await supabase.rpc("current_org_id");
    if (e0) {
      setError(e0.message);
      setSessions([]);
      setLoading(false);
      return;
    }
    const oid = (rpcOrgId as string) ?? null;
    setOrgId(oid);

    if (!oid) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data, error: e1 } = await supabase
      .from("sessions")
      .select(
        `
        id,
        org_id,
        product_id,
        client_id,
        name,
        delivery_type,
        start_date,
        end_date,
        certification_date,
        location_structure,
        location_street,
        location_postal_code,
        location_city
      `
      )
      .eq("org_id", oid)
      .order("start_date", { ascending: false });

    if (e1) {
      setError(e1.message);
      setSessions([]);
      setLoading(false);
      return;
    }

    const baseRows: SessionRow[] = ((data as SessionRow[]) ?? []).map((s) => ({
      ...s,
      client_name: null,
      product_name: null,
    }));

    const clientIds = Array.from(new Set(baseRows.map((r) => r.client_id).filter(Boolean))) as string[];
    const productIds = Array.from(new Set(baseRows.map((r) => r.product_id).filter(Boolean))) as string[];

    const clientsMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients, error: cErr } = await supabase
        .from("clients")
        .select("id,name")
        .in("id", clientIds);

      if (cErr) {
        setError(cErr.message);
      } else {
        (clients ?? []).forEach((c: any) => clientsMap.set(c.id, c.name));
      }
    }

    const productsMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id,name")
        .in("id", productIds);

      if (pErr) {
        setError(pErr.message);
      } else {
        (products ?? []).forEach((p: any) => productsMap.set(p.id, p.name));
      }
    }

    const enriched = baseRows.map((r) => ({
      ...r,
      client_name: r.client_id ? clientsMap.get(r.client_id) ?? null : null,
      product_name: r.product_id ? productsMap.get(r.product_id) ?? null : null,
    }));

    setSessions(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [createOpen, setCreateOpen] = useState(false);

  const handleSessionCreated = async (s?: CreatedSessionPayload) => {
    if (!s || !s.id) return;

    await fetchSessions();

    const ok = window.confirm("Session enregistrée ✅\n\nAjouter des apprenants en multiple maintenant ?");
    if (!ok) return;

    const params = new URLSearchParams();
    params.set("multi", "1");
    params.set("session_id", s.id);

    if (s.name) params.set("session_name", s.name);
    if (s.start_date) params.set("start_date", s.start_date);
    if (s.end_date) params.set("end_date", s.end_date);
    if (s.client_id) params.set("client_id", s.client_id);
    if (s.product_id) params.set("product_id", s.product_id);

    router.push(`/apprenants?${params.toString()}`);
  };

  const stats = useMemo(() => {
    const y = new Date().getFullYear();
    const yPrev = y - 1;

    const sessionsY = sessions.filter(
      (s) => s.start_date && new Date(s.start_date).getFullYear() === y
    );
    const sessionsPrev = sessions.filter(
      (s) => s.start_date && new Date(s.start_date).getFullYear() === yPrev
    );

    return {
      y,
      yPrev,
      sessionsThisYear: sessionsY.length,
      sessionsPrevYear: sessionsPrev.length,
      totalDays: sessionsY.reduce((acc, s) => acc + daysInclusive(s.start_date, s.end_date), 0),
      totalDaysPrev: sessionsPrev.reduce((acc, s) => acc + daysInclusive(s.start_date, s.end_date), 0),
      apprenants: 0,
      apprenantsPrev: 0,
      valides: 0,
      validesPrev: 0,
    };
  }, [sessions]);

  const openEdit = (s: SessionRow) => {
    setEditing(s);
    setEditName(s.name ?? "");
    setEditStart(s.start_date ?? "");
    setEditEnd(s.end_date ?? "");
    setEditCertif(s.certification_date ?? "");
    setEditDelivery((s.delivery_type ?? "direct") as any);
    setEditLocStructure(s.location_structure ?? "");
    setEditLocStreet(s.location_street ?? "");
    setEditLocPostal(s.location_postal_code ?? "");
    setEditLocCity(s.location_city ?? "");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    const { error: uErr } = await supabase
      .from("sessions")
      .update({
        name: editName || null,
        start_date: editStart || null,
        end_date: editEnd || null,
        certification_date: editCertif || null,
        delivery_type: editDelivery as any,
        location_structure: editLocStructure || null,
        location_street: editLocStreet || null,
        location_postal_code: editLocPostal || null,
        location_city: editLocCity || null,
      })
      .eq("id", editing.id);

    if (uErr) {
      setError(uErr.message);
      return;
    }

    closeEdit();
    fetchSessions();
  };

  const deleteSession = async (id: string) => {
    const ok = window.confirm("Supprimer cette session ?");
    if (!ok) return;

    const { error: dErr } = await supabase.from("sessions").delete().eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    fetchSessions();
  };

  const fetchApprenantsForSession = async (sessionId: string) => {
    setSessionApprenantsLoading(true);
    setSessionApprenantsError(null);

    try {
      const { data: piv, error: pivErr } = await supabase
        .from("apprenant_sessions")
        .select("apprenant_id")
        .eq("session_id", sessionId);

      if (pivErr) throw pivErr;

      const apprenantIds = Array.from(
        new Set((piv ?? []).map((x: any) => x.apprenant_id).filter(Boolean))
      ) as string[];

      if (apprenantIds.length === 0) {
        setSessionApprenants([]);
        return;
      }

      const { data: vData, error: vErr } = await supabase
        .from("apprenants_view")
        .select("id,last_name,first_name,candidate_validated")
        .in("id", apprenantIds);

      if (vErr) throw vErr;

      const { data: aData, error: aErr } = await supabase
        .from("apprenants")
        .select("id,birth_date")
        .in("id", apprenantIds);

      if (aErr) throw aErr;

      const birthById = new Map<string, string | null>();
      (aData ?? []).forEach((a: any) => birthById.set(a.id, a.birth_date ?? null));

      const rows: SessionApprenantRow[] = ((vData ?? []) as any[]).map((r) => ({
        id: r.id,
        last_name: r.last_name ?? null,
        first_name: r.first_name ?? null,
        candidate_validated: r.candidate_validated ?? null,
        birth_date: birthById.get(r.id) ?? null,
      }));

      rows.sort((a, b) =>
        `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(
          `${b.last_name ?? ""} ${b.first_name ?? ""}`,
          "fr",
          { sensitivity: "base" }
        )
      );

      setSessionApprenants(rows);
    } catch (e: any) {
      setSessionApprenants([]);
      setSessionApprenantsError(e?.message ?? "Erreur chargement apprenants");
    } finally {
      setSessionApprenantsLoading(false);
    }
  };

  const openView = (s: SessionRow) => {
    setViewing(s);
    setViewOpen(true);
    fetchApprenantsForSession(s.id);
  };

  const closeView = () => {
    setViewOpen(false);
    setViewing(null);
    setSessionApprenants([]);
    setSessionApprenantsError(null);
    setSessionApprenantsLoading(false);
  };

  const toggleSort = (key: ColumnKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const sortedRows = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const res = compare((a as any)[sort.key], (b as any)[sort.key]);
      return sort.dir === "asc" ? res : -res;
    });
    return copy;
  }, [sessions, sort]);

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleCols[c.key]),
    [visibleCols]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sessions</h1>

        <div className="flex items-center gap-2">
          <div className="relative">
            <details className="group">
              <summary className="cursor-pointer select-none rounded-lg border px-3 py-2 text-sm">
                Colonnes
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border bg-white p-2 shadow-xl">
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-sm">
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

         // ✅ Et ton bouton devient EXACTEMENT ça (dans le render)

{canCreate && (
  <button style={primaryBtnStyle} onClick={openCreateModal} type="button">
    + Nouvelle session
  </button>
)}

      
        </div>
      </div>

      <CreateSessionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(s: any) => {
          setCreateOpen(false);
          handleSessionCreated(s);
        }}
      />

      <div className="grid grid-cols-4 gap-6">
        <KpiCard title="Sessions" year={stats.y} value={stats.sessionsThisYear} prevYear={stats.yPrev} prevValue={stats.sessionsPrevYear} />
        <KpiCard title="Jours" year={stats.y} value={stats.totalDays} prevYear={stats.yPrev} prevValue={stats.totalDaysPrev} />
        <KpiCard title="Apprenants" year={stats.y} value={stats.apprenants} prevYear={stats.yPrev} prevValue={stats.apprenantsPrev} />
        <KpiCard title="Validés" year={stats.y} value={stats.valides} prevYear={stats.yPrev} prevValue={stats.validesPrev} />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <div className="font-semibold">Erreur</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border p-6 text-muted-foreground">Chargement…</div>
      ) : sortedRows.length === 0 ? (
        <div className="rounded-2xl border p-6 text-muted-foreground">Aucune session pour le moment</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {visibleColumns.map((col) => {
                  const isSorted = sort.key === col.key;
                  const arrow = isSorted ? (sort.dir === "asc" ? "▲" : "▼") : "";
                  return (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium text-muted-foreground"
                      onClick={() => toggleSort(col.key)}
                      title="Trier"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label} <span className="text-[10px]">{arrow}</span>
                      </span>
                    </th>
                  );
                })}
                <th className="whitespace-nowrap px-2 py-2 text-right text-[11px] font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/20">
                  {visibleColumns.map((col) => {
                    let value: React.ReactNode = (s as any)[col.key];

                    if (col.key === "name") value = s.name ?? "—";
                    if (col.key === "client_name") value = s.client_name ?? "—";
                    if (col.key === "product_name") value = s.product_name ?? "—";
                    if (col.key === "start_date") value = formatDate(s.start_date);
                    if (col.key === "end_date") value = formatDate(s.end_date);
                    if (col.key === "certification_date") value = formatDate(s.certification_date ?? null);
                    if (col.key === "delivery_type") value = deliveryLabel(s.delivery_type ?? null);

                    return (
                      <td key={col.key} className="whitespace-nowrap px-2 py-2 text-[13px]">
                        {value}
                      </td>
                    );
                  })}

                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openView(s)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-lg text-black"
                        title="Visualiser"
                      >
                        <span className="leading-none">👁️</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-lg text-black"
                        title="Modifier"
                      >
                        <span className="leading-none">✏️</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteSession(s.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500 bg-white text-lg text-red-600"
                        title="Supprimer"
                      >
                        <span className="leading-none">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewOpen && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="text-xl font-semibold">Détails de la session</div>
              <button onClick={closeView} className="text-sm">
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">Nom</div>
                <div className="mt-1 font-semibold">{viewing.name ?? "—"}</div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="mt-1 font-semibold">{deliveryLabel(viewing.delivery_type ?? null)}</div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">Dates</div>
                <div className="mt-1 font-semibold">
                  {viewing.start_date ?? "—"} → {viewing.end_date ?? "—"}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">Certification</div>
                <div className="mt-1 font-semibold">{viewing.certification_date ?? "—"}</div>
              </div>

              <div className="col-span-2 rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">Lieu</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div>{viewing.location_structure ?? "—"}</div>
                  <div>{viewing.location_street ?? "—"}</div>
                  <div>
                    {(viewing.location_postal_code ?? "—") + " " + (viewing.location_city ?? "")}
                  </div>
                </div>
              </div>

              <div className="col-span-2 rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Apprenants liés</div>
                  <div className="text-xs text-muted-foreground">
                    {sessionApprenantsLoading ? "Chargement…" : `${sessionApprenants.length}`}
                  </div>
                </div>

                {sessionApprenantsError ? (
                  <div className="text-sm text-red-600">{sessionApprenantsError}</div>
                ) : sessionApprenantsLoading ? (
                  <div className="text-sm text-muted-foreground">Chargement des apprenants…</div>
                ) : sessionApprenants.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucun apprenant lié à cette session.</div>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium text-muted-foreground">
                            Nom
                          </th>
                          <th className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium text-muted-foreground">
                            Prénom
                          </th>
                          <th className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium text-muted-foreground">
                            Naissance
                          </th>
                          <th className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium text-muted-foreground">
                            Validé
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionApprenants.map((a) => (
                          <tr key={a.id} className="border-t">
                            <td className="whitespace-nowrap px-2 py-2 text-[13px]">{a.last_name ?? "—"}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-[13px]">{a.first_name ?? "—"}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-[13px]">{formatDate(a.birth_date)}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-[13px]">
                              {a.candidate_validated === true ? "Oui" : a.candidate_validated === false ? "Non" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={closeView} className="rounded-lg border px-4 py-2">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="text-xl font-semibold">Modifier la session</div>
              <button onClick={closeEdit} className="text-sm">
                Fermer
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 text-sm text-muted-foreground">Nom de session</div>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Du</div>
                  <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>

                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Au</div>
                  <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Certification</div>
                  <input type="date" value={editCertif} onChange={(e) => setEditCertif(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>

                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Type</div>
                  <select value={editDelivery} onChange={(e) => setEditDelivery(e.target.value as any)} className="w-full rounded-lg border px-3 py-2">
                    <option value="direct">Client direct</option>
                    <option value="subcontract">Sous-traitance</option>
                    <option value="sous_traitee">Sous-traitée</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Structure</div>
                  <input value={editLocStructure} onChange={(e) => setEditLocStructure(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>

                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Rue</div>
                  <input value={editLocStreet} onChange={(e) => setEditLocStreet(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">CP</div>
                  <input value={editLocPostal} onChange={(e) => setEditLocPostal(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>

                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Ville</div>
                  <input value={editLocCity} onChange={(e) => setEditLocCity(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeEdit} className="rounded-lg border px-4 py-2">
                Annuler
              </button>
              <button onClick={saveEdit} className="rounded-lg bg-black px-4 py-2 text-white">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
