"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* ================== TYPES ================== */
type PieRow = { label: string; value: number };
type YearRow = { year: number; value: number };
type CashflowRow = { year: number; revenue: number; expenses: number };
type Scope = "TOTAL" | "YEAR";

/* ================== HELPERS ================== */
const euro = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

const sum = (rows: PieRow[]) => rows.reduce((a, r) => a + (Number(r.value) || 0), 0);
const colorAt = (i: number) => `hsl(${(i * 47) % 360} 75% 45%)`;

const CA_COLOR = "#16a34a";
const EXP_COLOR = "#dc2626";

const safeArr = (x: any) => (Array.isArray(x) ? x : []);

function scopeLabel(scope: Scope, year: number) {
  return scope === "YEAR" ? `${year}` : "Total";
}
function yearFor(scope: Scope, year: number) {
  return scope === "YEAR" ? year : null;
}

/* ================== UI ================== */
function ToggleScope({
  yearLabel,
  value,
  onChange,
}: {
  yearLabel: number;
  value: Scope;
  onChange: (v: Scope) => void;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-xs font-semibold transition";
  const on = "bg-black text-white border-black";
  const off = "bg-white text-black hover:bg-gray-50";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`${base} ${value === "TOTAL" ? on : off}`}
        onClick={() => onChange("TOTAL")}
      >
        Total
      </button>
      <button
        type="button"
        className={`${base} ${value === "YEAR" ? on : off}`}
        onClick={() => onChange("YEAR")}
      >
        {yearLabel}
      </button>
    </div>
  );
}

function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/* ================== PAGE ================== */
export default function DashboardChartsClient() {
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [hasAnyData, setHasAnyData] = useState(true);

  const [revByClient, setRevByClient] = useState<PieRow[]>([]);
  const [expByCat, setExpByCat] = useState<PieRow[]>([]);
  const [learnersByProduct, setLearnersByProduct] = useState<PieRow[]>([]);
  const [sessionsByType, setSessionsByType] = useState<PieRow[]>([]);
  const [cashflowByYear, setCashflowByYear] = useState<CashflowRow[]>([]);

  const [rpcError, setRpcError] = useState<string | null>(null);

  const [revScope, setRevScope] = useState<Scope>("TOTAL");
  const [expScope, setExpScope] = useState<Scope>("TOTAL");
  const [learnersScope, setLearnersScope] = useState<Scope>("TOTAL");

  useEffect(() => {
    let alive = true;

    async function loadCharts() {
      if (!supabase) {
        if (!alive) return;
        setRevByClient([]);
        setExpByCat([]);
        setLearnersByProduct([]);
        setSessionsByType([]);
        setCashflowByYear([]);
        setHasAnyData(false);
        setRpcError("Supabase client introuvable");
        setLoading(false);
        return;
      }

      setLoading(true);
      setRpcError(null);

      const orgRes = await supabase.rpc("current_org_id");
      const orgId = (orgRes.data as string) ?? null;

      if (orgRes.error || !orgId) {
        if (!alive) return;
        setRevByClient([]);
        setExpByCat([]);
        setLearnersByProduct([]);
        setSessionsByType([]);
        setCashflowByYear([]);
        setHasAnyData(false);
        setRpcError(orgRes.error?.message ?? "Org introuvable (current_org_id = null)");
        setLoading(false);
        return;
      }

      const a = await supabase.rpc("dashboard_revenue_by_client", {
        p_year: yearFor(revScope, currentYear),
      });

      const [b, c, s0, d1, d2] = await Promise.all([
        supabase.rpc("dashboard_expenses_by_category", {
          p_org_id: orgId,
          p_year: yearFor(expScope, currentYear),
        }),
        supabase.rpc("dashboard_learners_by_product", {
          p_org_id: orgId,
          p_year: yearFor(learnersScope, currentYear),
        }),
        supabase.rpc("dashboard_sessions_by_type", { p_org_id: orgId }),
        supabase.rpc("dashboard_revenue_by_year", { p_org_id: orgId }),
        supabase.rpc("dashboard_expenses_by_year", { p_org_id: orgId }),
      ]);

      if (!alive) return;

      const err =
        a.error?.message ||
        b.error?.message ||
        c.error?.message ||
        s0.error?.message ||
        d1.error?.message ||
        d2.error?.message ||
        null;

      if (err) setRpcError(err);

      const ra = safeArr(a.data);
      const rb = safeArr(b.data);
      const rc = safeArr(c.data);
      const rs = safeArr(s0.data);
      const rd1 = safeArr(d1.data);
      const rd2 = safeArr(d2.data);

      setHasAnyData(ra.length + rb.length + rc.length + rs.length + rd1.length + rd2.length > 0);

      setRevByClient(
        ra.map((r: any) => ({
          label: String(r.label ?? ""),
          value: Number(r.value) || 0,
        }))
      );

      setExpByCat(
        rb.map((r: any) => ({
          label: String(r.label ?? ""),
          value: Number(r.value) || 0,
        }))
      );

      setLearnersByProduct(
        rc.map((r: any) => ({
          label: String(r.label ?? ""),
          value: Number(r.value) || 0,
        }))
      );

      setSessionsByType(
        rs.map((r: any) => ({
          label: String(r.label ?? ""),
          value: Number(r.value) || 0,
        }))
      );

      const revRows: YearRow[] = rd1.map((r: any) => ({
        year: Number(r.year),
        value: Number(r.value) || 0,
      }));

      const expRows: YearRow[] = rd2.map((r: any) => ({
        year: Number(r.year),
        value: Number(r.value) || 0,
      }));

      const map = new Map<number, CashflowRow>();

      for (const r of revRows) {
        if (!Number.isFinite(r.year)) continue;
        map.set(r.year, { year: r.year, revenue: r.value, expenses: 0 });
      }

      for (const e of expRows) {
        if (!Number.isFinite(e.year)) continue;
        const prev = map.get(e.year) ?? { year: e.year, revenue: 0, expenses: 0 };
        prev.expenses = e.value;
        map.set(e.year, prev);
      }

      setCashflowByYear(Array.from(map.values()).sort((x, y) => x.year - y.year));
      setLoading(false);
    }

    void loadCharts();

    return () => {
      alive = false;
    };
  }, [revScope, expScope, learnersScope, currentYear]);

  const revTotal = useMemo(() => sum(revByClient), [revByClient]);
  const expTotal = useMemo(() => sum(expByCat), [expByCat]);
  const learnersTotal = useMemo(() => sum(learnersByProduct), [learnersByProduct]);
  const sessionsTotal = useMemo(() => sum(sessionsByType), [sessionsByType]);

  if (!loading && !rpcError && !hasAnyData) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        Aucun graphique disponible pour ton profil.
      </div>
    );
  }

  const showRev = !loading && revByClient.length > 0;
  const showSessions = !loading && sessionsByType.length > 0;
  const showExp = !loading && expByCat.length > 0;
  const showLearners = !loading && learnersByProduct.length > 0;
  const showCashflow = !loading && cashflowByYear.length > 0;

  return (
    <div className="space-y-6">
      {rpcError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <div className="font-semibold">RPC error</div>
          <div className="text-muted-foreground">{rpcError}</div>
        </div>
      ) : null}

      {showRev && (
        <Card
          title="Répartition des recettes par clients"
          subtitle={`${scopeLabel(revScope, currentYear)} — Total encaissé : ${euro(revTotal)}`}
          actions={<ToggleScope yearLabel={currentYear} value={revScope} onChange={setRevScope} />}
        >
          {loading ? (
            <Empty text="Chargement…" />
          ) : revByClient.length === 0 ? (
            <Empty text="Aucune donnée (dashboard_revenue_by_client)." />
          ) : (
            <div className="flex gap-6">
              <div className="h-[320px] w-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revByClient}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={80}
                      outerRadius={120}
                    >
                      {revByClient.map((_, i) => (
                        <Cell key={i} fill={colorAt(i)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => euro(Number(v) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2">
                {revByClient.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-3 w-3 rounded" style={{ background: colorAt(i) }} />
                    <div className="flex-1 font-semibold">{r.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {revTotal > 0 ? `${Math.round((r.value / revTotal) * 100)}%` : "—"}
                    </div>
                    <div className="font-bold">{euro(r.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {showSessions && (
        <Card title="Répartition des sessions" subtitle={`Total : ${Math.round(sessionsTotal)}`}>
          <div className="flex gap-6">
            <div className="h-[320px] w-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sessionsByType}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={80}
                    outerRadius={120}
                  >
                    {sessionsByType.map((_, i) => (
                      <Cell key={i} fill={colorAt(i)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${Number(v) || 0}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-2">
              {sessionsByType.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-3 w-3 rounded" style={{ background: colorAt(i) }} />
                  <div className="flex-1 font-semibold">{r.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {sessionsTotal > 0 ? `${Math.round((r.value / sessionsTotal) * 100)}%` : "—"}
                  </div>
                  <div className="font-bold">{Math.round(r.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showExp && (
        <Card
          title="Répartition des dépenses par catégorie"
          subtitle={`${scopeLabel(expScope, currentYear)} — Total : ${euro(expTotal)}`}
          actions={<ToggleScope yearLabel={currentYear} value={expScope} onChange={setExpScope} />}
        >
          {loading ? (
            <Empty text="Chargement…" />
          ) : expByCat.length === 0 ? (
            <Empty text="Aucune donnée (dashboard_expenses_by_category)." />
          ) : (
            <div className="flex gap-6">
              <div className="h-[320px] w-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expByCat}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={80}
                      outerRadius={120}
                    >
                      {expByCat.map((_, i) => (
                        <Cell key={i} fill={colorAt(i)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => euro(Number(v) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2">
                {expByCat.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-3 w-3 rounded" style={{ background: colorAt(i) }} />
                    <div className="flex-1 font-semibold">{r.label}</div>
                    <div className="font-bold">{euro(r.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {showLearners && (
        <Card
          title="Répartition des apprenants par formations"
          subtitle={`${scopeLabel(learnersScope, currentYear)} — Total : ${Math.round(learnersTotal)}`}
          actions={
            <ToggleScope
              yearLabel={currentYear}
              value={learnersScope}
              onChange={setLearnersScope}
            />
          }
        >
          {loading ? (
            <Empty text="Chargement…" />
          ) : learnersByProduct.length === 0 ? (
            <Empty text="Aucune donnée (dashboard_learners_by_product)." />
          ) : (
            <div className="flex gap-6">
              <div className="h-[320px] w-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={learnersByProduct}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={80}
                      outerRadius={120}
                    >
                      {learnersByProduct.map((_, i) => (
                        <Cell key={i} fill={colorAt(i)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${Number(v) || 0}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2">
                {learnersByProduct.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-3 w-3 rounded" style={{ background: colorAt(i) }} />
                    <div className="flex-1 font-semibold">{r.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {learnersTotal > 0 ? `${Math.round((r.value / learnersTotal) * 100)}%` : "—"}
                    </div>
                    <div className="font-bold">{Math.round(r.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {showCashflow && (
        <Card title="Évolution du CA encaissé et des dépenses réglées par années">
          {loading ? (
            <Empty text="Chargement…" />
          ) : cashflowByYear.length === 0 ? (
            <Empty text="Aucune donnée (dashboard_revenue_by_year / dashboard_expenses_by_year)." />
          ) : (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflowByYear}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip
                    formatter={(v: any, name: any) => [
                      euro(Number(v) || 0),
                      name === "revenue" ? "CA encaissé" : "Dépenses réglées",
                    ]}
                    labelFormatter={(l: any) => `Année ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={CA_COLOR}
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke={EXP_COLOR}
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}