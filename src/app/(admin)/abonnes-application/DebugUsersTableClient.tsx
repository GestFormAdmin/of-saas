// src/app/(admin)/abonnes-application/DebugUsersTableClient.tsx
'use client';

import * as React from 'react';

export type DebugUserRow = {
  user_id: string;
  email: string | null;
};

export default function DebugUsersTableClient({ rows }: { rows: DebugUserRow[] }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-medium [&>th]:text-slate-700">
            <th>User ID</th>
            <th>Email</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {safeRows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-slate-500" colSpan={2}>
                Aucun utilisateur.
              </td>
            </tr>
          ) : (
            safeRows.map((r, idx) => (
              <tr key={r.user_id ?? `row-${idx}`} className="[&>td]:px-4 [&>td]:py-3">
                <td className="font-mono text-xs text-slate-800">{r.user_id}</td>
                <td className="text-slate-800">{r.email ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
