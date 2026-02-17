// src/app/(admin)/settings/abonnement/SubscribersTableClient.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';

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
  subscription_status: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(d));
}

function fmtMoneyCents(cents: number | null) {
  if (cents == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export default function SubscribersTableClient({ rows }: { rows: SubscriberRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-slate-700">
            <th>Nom</th>
            <th>Prénom</th>
            <th>OF</th>
            <th>Mail</th>
            <th>Date de souscription</th>
            <th>Montant abonnement</th>
            <th>Dernier prélèvement</th>
            <th>Nb apprenants N-1</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-slate-500" colSpan={9}>
                Aucun abonné.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.user_id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="font-medium text-slate-900">{r.last_name ?? '—'}</td>
                <td className="text-slate-900">{r.first_name ?? '—'}</td>
                <td className="text-slate-700">{r.org_name ?? '—'}</td>
                <td className="text-slate-700">{r.email ?? '—'}</td>
                <td className="text-slate-700">{fmtDate(r.subscribed_at)}</td>
                <td className="text-slate-900">{fmtMoneyCents(r.amount_cents)}</td>
                <td className="text-slate-700">{fmtDate(r.last_charge_at)}</td>
                <td className="text-slate-900">{r.apprenants_n_1 ?? 0}</td>

                <td className="whitespace-nowrap text-right">
                  <div className="inline-flex gap-2">
                    <Button size="sm" onClick={() => console.log('visualiser', r.user_id)}>
                      Visualiser
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => console.log('revoquer', r.user_id)}>
                      Révoquer
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => console.log('bloquer', r.user_id)}>
                      Bloquer
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => console.log('abonnement', r.user_id)}>
                      Abonnement
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
