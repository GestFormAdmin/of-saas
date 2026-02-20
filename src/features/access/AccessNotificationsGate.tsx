'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/browser';

type AccessEventType = 'invite_created' | 'member_revoked' | 'member_left' | 'session_created';

type AccessNotif = {
  id: string;
  org_id: string | null;
  event_type: AccessEventType;
  payload: Record<string, any> | null;
  created_at: string;
};

export default function AccessNotificationsGate() {
  const [queue, setQueue] = useState<AccessNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => (queue.length ? queue[0] : null), [queue]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_pending_access_notifications');
      if (!alive) return;

      if (error) {
        setQueue([]);
        setLoading(false);
        return;
      }

      setQueue((data ?? []) as AccessNotif[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function markSeen(id: string) {
    await supabase.rpc('mark_access_notification_seen', { p_notification_id: id });
  }

  async function popCurrentSeen() {
    if (!current) return;
    await markSeen(current.id);
    setQueue((q) => q.slice(1));
  }

  async function acceptInvite(invitationId: string) {
    await supabase.rpc('accept_invitation', { p_invitation_id: invitationId });
  }

  async function declineInvite(invitationId: string) {
    await supabase.rpc('decline_invitation', { p_invitation_id: invitationId });
  }

  const open = !loading && !!current;
  if (!open || !current) return null;

  const payload = current.payload ?? {};
  const orgName = payload.org_name ?? 'Organisation';

  const invitationId =
    typeof payload.invitation_id === 'string' ? payload.invitation_id : undefined;

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : undefined;
  const sessionName = payload.session_name ?? 'Session';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
        {current.event_type === 'invite_created' && (
          <>
            <div className="text-lg font-semibold">Invitation</div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{orgName}</span> vous a invité.
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                className="rounded-xl px-4 py-2 border disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    if (invitationId) await declineInvite(invitationId);
                  } finally {
                    await popCurrentSeen();
                    setBusy(false);
                  }
                }}
              >
                Décliner
              </button>

              <button
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    if (invitationId) await acceptInvite(invitationId);
                  } finally {
                    await popCurrentSeen();
                    setBusy(false);
                  }
                }}
              >
                Accepter
              </button>
            </div>
          </>
        )}

        {current.event_type === 'member_revoked' && (
          <>
            <div className="text-lg font-semibold">Accès retiré</div>
            <div className="text-sm text-gray-600">
              Votre accès à <span className="font-medium">{orgName}</span> a été supprimé.
            </div>

            <div className="flex justify-end pt-2">
              <button
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await popCurrentSeen();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                OK
              </button>
            </div>
          </>
        )}

        {current.event_type === 'member_left' && (
          <>
            <div className="text-lg font-semibold">Membre parti</div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{payload.user_name ?? 'Un membre'}</span> a quitté{' '}
              <span className="font-medium">{orgName}</span>.
            </div>

            <div className="flex justify-end pt-2">
              <button
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await popCurrentSeen();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                OK
              </button>
            </div>
          </>
        )}

        {current.event_type === 'session_created' && (
          <>
            <div className="text-lg font-semibold">Nouvelle session assignée</div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{orgName}</span> a créé une session pour vous :{' '}
              <span className="font-medium">{sessionName}</span>.
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                className="rounded-xl px-4 py-2 border disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await popCurrentSeen();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Plus tard
              </button>

              <button
                className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await popCurrentSeen();
                    if (sessionId) {
                      window.location.href = `/sessions?focus=${encodeURIComponent(sessionId)}`;
                    } else {
                      window.location.href = `/sessions`;
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Voir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
