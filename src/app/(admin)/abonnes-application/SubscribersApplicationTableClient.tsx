'use client';

import * as React from 'react';
import { Eye, UserX, Ban, Unlock, CreditCard, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';

export type SubscriberRow = {
  user_id: string;

  // anciens champs
  first_name: string | null;
  last_name: string | null;
  org_name: string | null;
  email: string | null;

  subscribed_at: string | null;
  amount_cents: number | null;
  last_charge_at: string | null;
  apprenants_n_1: number | null;
  invited_trainers_count: number | null;
  subscription_status: string | null;
  banned_until: string | null;

  plan_code: string | null;
  plan_amount_cents: number | null;

  // compat backend (nouveaux champs possibles)
  plan?: string | null;
  status?: string | null;
  subscription_date?: string | null;
  last_payment_date?: string | null;
  apprenants_n1?: number | null;

  // compat keys alternatifs possibles
  firstname?: string | null;
  lastname?: string | null;
  org?: string | null;
  organization_name?: string | null;
  company?: string | null;
};

type SortKey =
  | 'last_name'
  | 'first_name'
  | 'org_name'
  | 'email'
  | 'subscribed_at'
  | 'amount_cents'
  | 'last_charge_at'
  | 'apprenants_n_1'
  | 'plan_activated'
  | 'invited_trainers_count';

type SortDir = 'asc' | 'desc';

function fmtDate(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

function fmtMoneyCents(cents: number | null) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function toLowerSafe(v: unknown) {
  return String(v ?? '').toLowerCase();
}

function dateToMs(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function isBlocked(banned_until: string | null) {
  if (!banned_until) return false;
  const d = new Date(banned_until);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function compareNullable(a: any, b: any, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1;

  const aNull = a == null || a === '';
  const bNull = b == null || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a === b ? 0 : a < b ? -1 * sign : 1 * sign;
  }

  const as = toLowerSafe(a);
  const bs = toLowerSafe(b);
  if (as === bs) return 0;
  return as < bs ? -1 * sign : 1 * sign;
}

function planLabel(code: string | null) {
  const c = String(code ?? 'free').toLowerCase();
  if (c === 'free' || c === 'starter') return 'Starter';
  if (c === 'pro') return 'Pro';
  if (c === 'business') return 'Business';
  if (c === 'scale') return 'Scale';
  if (c === 'enterprise' || c === 'scale+') return 'Scale+';
  if (c === 'custom') return 'Sur devis';
  return c;
}

function pickStr(...vals: Array<unknown>) {
  for (const v of vals) {
    const s = typeof v === 'string' ? v : v == null ? '' : String(v);
    if (s.trim()) return s;
  }
  return null;
}

function getFirstName(r: SubscriberRow) {
  const anyR = r as any;
  return pickStr(r.first_name, anyR.firstname, anyR.prenom, anyR.firstName);
}

function getLastName(r: SubscriberRow) {
  const anyR = r as any;
  return pickStr(r.last_name, anyR.lastname, anyR.nom, anyR.lastName);
}

function getOrgName(r: SubscriberRow) {
  const anyR = r as any;
  return pickStr(r.org_name, anyR.org, anyR.organization_name, anyR.company, anyR.orgName);
}

function getPlanCode(r: SubscriberRow) {
  const raw = (r.plan_code ?? r.plan ?? (r as any).plan_code_snapshot ?? null) as any;
  return raw == null ? null : String(raw);
}

function getSubscribedAt(r: SubscriberRow) {
  return r.subscribed_at ?? r.subscription_date ?? (r as any).subscriptionDate ?? null;
}

function getLastChargeAt(r: SubscriberRow) {
  return r.last_charge_at ?? r.last_payment_date ?? (r as any).lastPaymentDate ?? null;
}

function getApprenantsN1(r: SubscriberRow) {
  const v = r.apprenants_n_1 ?? r.apprenants_n1 ?? (r as any).apprenantsN1 ?? null;
  if (v == null) return null;
  return typeof v === 'number' ? v : Number(v);
}

function sortValue(r: SubscriberRow, key: SortKey) {
  switch (key) {
    case 'subscribed_at':
      return dateToMs(getSubscribedAt(r));
    case 'last_charge_at':
      return dateToMs(getLastChargeAt(r));
    case 'amount_cents':
      return r.amount_cents ?? null;
    case 'apprenants_n_1':
      return getApprenantsN1(r);
    case 'plan_activated':
      return planLabel(getPlanCode(r));
    case 'invited_trainers_count':
      return r.invited_trainers_count ?? null;
    case 'last_name':
      return getLastName(r) ?? null;
    case 'first_name':
      return getFirstName(r) ?? null;
    case 'org_name':
      return getOrgName(r) ?? null;
    case 'email':
      return r.email ?? null;
    default:
      return null;
  }
}

function SortTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-2 hover:text-slate-900">
        {label}
        <span className="text-xs">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function ActionIcon({
  children,
  onClick,
  title,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'h-8 w-8 inline-flex items-center justify-center rounded-full transition',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function UserDetailsModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: SubscriberRow | null;
}) {
  if (!open || !user) return null;

  const first = getFirstName(user);
  const last = getLastName(user);
  const org = getOrgName(user);
  const plan = planLabel(getPlanCode(user));
  const subscribedAt = getSubscribedAt(user);
  const lastChargeAt = getLastChargeAt(user);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {first ?? '—'} {last ?? ''}
              </div>
              <div className="text-xs text-slate-600 truncate">{user.email ?? '—'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">OF</div>
                <div className="text-slate-900">{org ?? '—'}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Compte</div>
                <div className="text-slate-900">{isBlocked(user.banned_until) ? 'Bloqué' : 'Actif'}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Plan (réel)</div>
                <div className="text-slate-900">{plan}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Prix du plan</div>
                <div className="text-slate-900">{fmtMoneyCents(user.plan_amount_cents)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Date souscription</div>
                <div className="text-slate-900">{fmtDate(subscribedAt)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Dernier prélèvement</div>
                <div className="text-slate-900">{fmtDate(lastChargeAt)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Montant dernier prélèvement</div>
                <div className="text-slate-900">{fmtMoneyCents(user.amount_cents)}</div>
              </div>

              <div className="rounded-xl border p-3 sm:col-span-2">
                <div className="text-xs text-slate-500">Formateurs invités</div>
                <div className="text-slate-900">{user.invited_trainers_count ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="border-t px-4 py-3 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubscribersApplicationTableClient({ rows }: { rows: SubscriberRow[] }) {
  const initialRows = Array.isArray(rows) ? rows : [];
  const [localRows, setLocalRows] = React.useState<SubscriberRow[]>(initialRows);

  React.useEffect(() => {
    setLocalRows(Array.isArray(rows) ? rows : []);
  }, [rows]);

  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('last_name');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsUser, setDetailsUser] = React.useState<SubscriberRow | null>(null);

  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localRows;

    return localRows.filter((r) => {
      const plan = planLabel(getPlanCode(r));
      const hay =
        [
          getFirstName(r),
          getLastName(r),
          getOrgName(r),
          r.email,
          r.subscription_status,
          r.amount_cents,
          getApprenantsN1(r),
          plan,
          r.invited_trainers_count,
          isBlocked(r.banned_until) ? 'bloqué' : 'actif',
        ]
          .map((x) => toLowerSafe(x))
          .join(' ') ?? '';

      return hay.includes(q);
    });
  }, [localRows, query]);

  const sorted = React.useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareNullable(sortValue(a, sortKey), sortValue(b, sortKey), sortDir));
    return copy;
  }, [filtered, sortKey, sortDir]);

  const onRevoquer = async (r: SubscriberRow) => {
    const ok = window.confirm(
      `Révoquer ${r.email ?? r.user_id} ?\n\nAccès retirés + connexion bloquée.\nLes données liées à un OF ne seront pas supprimées.`
    );
    if (!ok) return;

    setBusyUserId(r.user_id);
    const { error } = await supabase.rpc('admin_revoke_user', { p_user_id: r.user_id });
    setBusyUserId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setLocalRows((prev) =>
      prev.map((x) =>
        x.user_id === r.user_id
          ? {
              ...x,
              first_name: null,
              last_name: null,
              org_name: null,
              banned_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100).toISOString(),
            }
          : x
      )
    );

    if (detailsUser?.user_id === r.user_id) {
      setDetailsOpen(false);
      setDetailsUser(null);
    }
  };

  const onToggleBlock = async (r: SubscriberRow) => {
    const blocked = isBlocked(r.banned_until);
    const ok = window.confirm(blocked ? `Débloquer ${r.email ?? r.user_id} ?` : `Bloquer ${r.email ?? r.user_id} ?`);
    if (!ok) return;

    setBusyUserId(r.user_id);
    const { data, error } = await supabase.rpc('admin_toggle_block_user', { p_user_id: r.user_id });
    setBusyUserId(null);

    if (error) {
      alert(error.message);
      return;
    }

    const newBannedUntil = data ? String(data) : null;
    setLocalRows((prev) => prev.map((x) => (x.user_id === r.user_id ? { ...x, banned_until: newBannedUntil } : x)));
  };

  return (
    <div className="space-y-4">
      <UserDetailsModal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsUser(null);
        }}
        user={detailsUser}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {sorted.length} résultat{sorted.length > 1 ? 's' : ''}
        </div>

        <div className="w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher nom, email, OF…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left [&>th]:font-medium [&>th]:text-slate-700">
              <SortTh label="Nom" k="last_name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Prénom" k="first_name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="OF" k="org_name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Mail" k="email" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Plan (réel)" k="plan_activated" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Souscription" k="subscribed_at" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Dernier prélèvement" k="amount_cents" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Date dernier paiement" k="last_charge_at" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Apprenants N-1" k="apprenants_n_1" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh
                label="Formateurs invités"
                k="invited_trainers_count"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-slate-500">
                  Aucun utilisateur.
                </td>
              </tr>
            ) : (
              sorted.map((r, idx) => {
                const disabled = busyUserId === r.user_id;
                const blocked = isBlocked(r.banned_until);

                const plan = planLabel(getPlanCode(r));
                const subscribedAt = getSubscribedAt(r);
                const lastChargeAt = getLastChargeAt(r);

                const first = getFirstName(r);
                const last = getLastName(r);
                const org = getOrgName(r);

                return (
                  <tr
                    key={`${r.user_id ?? 'noid'}-${org ?? 'noorg'}-${idx}`}
                    className={['[&>td]:px-4 [&>td]:py-3', blocked ? 'bg-red-50' : ''].join(' ')}
                  >
                    <td className={blocked ? 'font-medium text-red-800' : 'font-medium text-slate-900'}>{last ?? '—'}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{first ?? '—'}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{org ?? '—'}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{r.email ?? '—'}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{plan}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{fmtDate(subscribedAt)}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{fmtMoneyCents(r.amount_cents)}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{fmtDate(lastChargeAt)}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{getApprenantsN1(r) ?? 0}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{r.invited_trainers_count ?? 0}</td>

                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <ActionIcon
                          title="Visualiser"
                          onClick={() => {
                            setDetailsUser(r);
                            setDetailsOpen(true);
                          }}
                          disabled={disabled}
                          className="bg-blue-100 text-blue-600 hover:bg-blue-200"
                        >
                          <Eye size={16} />
                        </ActionIcon>

                        <ActionIcon
                          title="Révoquer"
                          onClick={() => onRevoquer(r)}
                          disabled={disabled}
                          className="bg-red-100 text-red-600 hover:bg-red-200"
                        >
                          <UserX size={16} />
                        </ActionIcon>

                        <ActionIcon
                          title={blocked ? 'Débloquer' : 'Bloquer'}
                          onClick={() => onToggleBlock(r)}
                          disabled={disabled}
                          className="bg-orange-100 text-orange-600 hover:bg-orange-200"
                        >
                          {blocked ? <Unlock size={16} /> : <Ban size={16} />}
                        </ActionIcon>

                        <ActionIcon
                          title="Abonnement (plan/prix visible dans fiche)"
                          onClick={() => {}}
                          disabled={true}
                          className="bg-emerald-100 text-emerald-600"
                        >
                          <CreditCard size={16} />
                        </ActionIcon>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
