'use client';

import * as React from 'react';
import { Eye, UserX, Ban, Unlock, CreditCard, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/browser';

export type SubscriberRow = {
  user_id: string;
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
};

type PlanCode = 'free' | 'pro' | 'business' | 'scale' | 'enterprise' | 'custom';

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

function planFromApprenantsN1(count: number | null): PlanCode {
  const c = count ?? 0;
  if (c <= 200) return 'free';
  if (c <= 500) return 'pro';
  if (c <= 1000) return 'business';
  if (c <= 1500) return 'scale';
  if (c <= 2000) return 'enterprise';
  return 'custom';
}

const PLAN_LABEL: Record<PlanCode, string> = {
  free: 'Starter',
  pro: 'Pro',
  business: 'Business',
  scale: 'Scale',
  enterprise: 'Scale+',
  custom: 'Sur devis',
};

function sortValue(r: SubscriberRow, key: SortKey) {
  switch (key) {
    case 'subscribed_at':
      return dateToMs(r.subscribed_at);
    case 'last_charge_at':
      return dateToMs(r.last_charge_at);
    case 'amount_cents':
      return r.amount_cents ?? null;
    case 'apprenants_n_1':
      return r.apprenants_n_1 ?? null;
    case 'plan_activated':
      return PLAN_LABEL[planFromApprenantsN1(r.apprenants_n_1)];
    case 'invited_trainers_count':
      return r.invited_trainers_count ?? null;
    case 'last_name':
      return r.last_name ?? null;
    case 'first_name':
      return r.first_name ?? null;
    case 'org_name':
      return r.org_name ?? null;
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

  const plan = planFromApprenantsN1(user.apprenants_n_1);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {user.first_name ?? '—'} {user.last_name ?? ''}
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
                <div className="text-slate-900">{user.org_name ?? '—'}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Compte</div>
                <div className="text-slate-900">{isBlocked(user.banned_until) ? 'Bloqué' : 'Actif'}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Plan activé</div>
                <div className="text-slate-900">{PLAN_LABEL[plan]}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Date souscription</div>
                <div className="text-slate-900">{fmtDate(user.subscribed_at)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Montant abonnement</div>
                <div className="text-slate-900">{fmtMoneyCents(user.amount_cents)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Dernier prélèvement</div>
                <div className="text-slate-900">{fmtDate(user.last_charge_at)}</div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Apprenants N-1</div>
                <div className="text-slate-900">{user.apprenants_n_1 ?? 0}</div>
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
      const plan = PLAN_LABEL[planFromApprenantsN1(r.apprenants_n_1)];
      const hay =
        [
          r.first_name,
          r.last_name,
          r.org_name,
          r.email,
          r.subscription_status,
          r.amount_cents,
          r.apprenants_n_1,
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

  const onVisualiser = (r: SubscriberRow) => {
    setDetailsUser(r);
    setDetailsOpen(true);
  };

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
              <SortTh label="Plan activé" k="plan_activated" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Souscription" k="subscribed_at" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Montant" k="amount_cents" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh label="Dernier paiement" k="last_charge_at" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
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
                const plan = PLAN_LABEL[planFromApprenantsN1(r.apprenants_n_1)];

                return (
                  <tr
                    key={`${r.user_id ?? 'noid'}-${r.org_name ?? 'noorg'}-${idx}`}
                    className={['[&>td]:px-4 [&>td]:py-3', blocked ? 'bg-red-50' : ''].join(' ')}
                  >
                    <td className={blocked ? 'font-medium text-red-800' : 'font-medium text-slate-900'}>
                      {r.last_name ?? '—'}
                    </td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{r.first_name ?? '—'}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{r.org_name ?? '—'}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{r.email ?? '—'}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{plan}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{fmtDate(r.subscribed_at)}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{fmtMoneyCents(r.amount_cents)}</td>
                    <td className={blocked ? 'text-red-700' : 'text-slate-700'}>{fmtDate(r.last_charge_at)}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{r.apprenants_n_1 ?? 0}</td>
                    <td className={blocked ? 'text-red-800' : 'text-slate-900'}>{r.invited_trainers_count ?? 0}</td>

                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <ActionIcon
                          title="Visualiser"
                          onClick={() => onVisualiser(r)}
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
                          title="Abonnement (bientôt)"
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
