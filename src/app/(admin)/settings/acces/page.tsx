"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { Eye, Pencil, Trash2 } from "lucide-react";

type Row = {
  org_id: string;
  org_name: string;
  org_type: "business" | "personal" | string | null;
  role: string | null;
};

type Member = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

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
        className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">{title}</div>
          <button
            className="h-9 w-9 rounded-xl border hover:bg-gray-50"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function AccessPage() {
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [myUserId, setMyUserId] = React.useState("");

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"member" | "admin">("member");

  const [currentOrgId, setCurrentOrgId] = React.useState<string | null>(null);
  const [currentOrgType, setCurrentOrgType] = React.useState<string | null>(null);
  const [currentOrgRole, setCurrentOrgRole] = React.useState<string | null>(null);

  const [businessRows, setBusinessRows] = React.useState<Row[]>([]);
  const [memberships, setMemberships] = React.useState<Row[]>([]);

  const [members, setMembers] = React.useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editMember, setEditMember] = React.useState<Member | null>(null);
  const [editRole, setEditRole] = React.useState<"member" | "admin">("member");
  const [savingRole, setSavingRole] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const emitOrgChanged = () => {
    window.dispatchEvent(new Event("fa:org_changed"));
  };

  const canInvite = currentOrgRole === "owner" || currentOrgRole === "admin";

  const canManageMembers = canInvite;

  const canCreateOF = React.useMemo(() => {
return !memberships.some((m) => m.role === "owner");
  }, [memberships]);

  const loadMembers = async (orgId: string) => {
    setMembersLoading(true);

    const { data, error } = await supabase.rpc("get_org_members", {
      p_org_id: orgId,
    });

    if (error) {
      setMessage(error.message);
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    setMembers((data ?? []) as Member[]);
    setMembersLoading(false);
  };

  const load = async () => {
    setLoading(true);
    setMessage(null);

    await supabase.rpc("accept_my_pending_invites");

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setMessage(userErr?.message ?? "Non connecté");
      setLoading(false);
      return;
    }

    setEmail(userData.user.email ?? "");
    setMyUserId(userData.user.id);

    const { data: curOrgId, error: curOrgErr } = await supabase.rpc("current_org_id");
    if (curOrgErr) {
      setMessage(curOrgErr.message);
      setLoading(false);
      return;
    }
    setCurrentOrgId(curOrgId ?? null);

    const { data: mData, error: mErr } = await supabase.rpc("get_my_memberships");
    if (mErr) {
      setMessage(mErr.message);
      setLoading(false);
      return;
    }

    const rows: Row[] = (mData ?? []).map((m: any) => ({
      org_id: m.org_id,
      org_name: m.org_name ?? "Organisme",
      org_type: m.org_type ?? null,
      role: m.role ?? null,
    }));

    setMemberships(rows);
setBusinessRows(rows);

    const current = rows.find((r) => r.org_id === curOrgId);
    setCurrentOrgType(current?.org_type ?? null);
    setCurrentOrgRole(current?.role ?? null);

   const canManage =
  (current?.role === "owner" || current?.role === "admin") &&
  !!curOrgId;


    if (canManage && curOrgId) {
      await loadMembers(curOrgId);
    } else {
      setMembers([]);
    }

    setLoading(false);
  };

  React.useEffect(() => {
    let alive = true;

    (async () => {
      await load();
    })();

    const onOrgChanged = () => {
      if (!alive) return;
      void load();
    };

    window.addEventListener("fa:org_changed", onOrgChanged);

    return () => {
      alive = false;
      window.removeEventListener("fa:org_changed", onOrgChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = async (orgId: string) => {
    setMessage(null);

    const { error } = await supabase.rpc("set_current_org", { p_org_id: orgId });
    if (error) {
      setMessage(error.message);
      return;
    }

    emitOrgChanged();

    setCurrentOrgId(orgId);
    router.replace("/dashboard");
    router.refresh();
  };

  const invite = async () => {
    setMessage(null);
    if (!inviteEmail || !currentOrgId) return;

    const { error } = await supabase.rpc("create_invite", {
      p_org_id: currentOrgId,
      p_email: inviteEmail,
      p_role: inviteRole,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInviteEmail("");
    setMessage("Invitation envoyée");
  };

  const leaveOrg = async (orgId: string, orgName: string) => {
    setMessage(null);
    if (!confirm(`Quitter définitivement "${orgName}" ?`)) return;

    const { error } = await supabase.rpc("leave_organization", {
      p_org_id: orgId,
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    await load();
    emitOrgChanged();
    router.refresh();
  };

  const revokeMember = async (userId: string, who: string) => {
    setMessage(null);
    if (!currentOrgId) return;

    if (!confirm(`Révoquer l'accès de ${who} ?`)) return;

    setMembers((prev) => prev.filter((m) => m.user_id !== userId));

    const { error } = await supabase.rpc("revoke_member_access", {
      p_org_id: currentOrgId,
      p_user_id: userId,
    });

    if (error) {
      setMessage(error.message);
      await loadMembers(currentOrgId);
      return;
    }

    await loadMembers(currentOrgId);
    setMessage("Accès révoqué");
  };

  const openEditRole = (m: Member) => {
    setEditError(null);
    setEditOpen(true);
    setEditMember(m);
    setEditRole((m.role === "admin" ? "admin" : "member") as any);
  };

  const saveRole = async () => {
    if (!currentOrgId || !editMember) return;

    setSavingRole(true);
    setEditError(null);
    setMessage(null);

    const { error } = await supabase.rpc("update_member_role", {
      p_org_id: currentOrgId,
      p_user_id: editMember.user_id,
      p_role: editRole,
    });

    setSavingRole(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    setEditOpen(false);
    setEditMember(null);

    await loadMembers(currentOrgId);
    setMessage("Rôle mis à jour");
    router.refresh();
  };

  const editTitle = React.useMemo(() => {
    if (!editMember) return "Modifier rôle";
    const fullName =
      [editMember.first_name, editMember.last_name].filter(Boolean).join(" ") || "—";
    return `Modifier rôle : ${fullName}`;
  }, [editMember]);

  const createMyOF = async () => {
    setMessage(null);
    if (!canCreateOF) {
      setMessage("Vous avez déjà un OF.");
      return;
    }

    const name = window.prompt("Nom de l'organisme (OF) ?");
    if (!name) return;

    const { data, error } = await supabase.rpc("create_business_org", { p_name: name });
    if (error) {
      setMessage(error.message);
      return;
    }

    const newOrgId = (typeof data === "string" ? data : null) as string | null;
    if (newOrgId) {
      await supabase.rpc("set_current_org", { p_org_id: newOrgId });
      emitOrgChanged();
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    await load();
    emitOrgChanged();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mes accès</h1>
          <p className="text-sm text-gray-500">Switch d’espace</p>
          <p className="mt-1 text-xs text-gray-400">Connecté : {email || "—"}</p>
        </div>

        {canCreateOF && (
          <button
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            onClick={() => void createMyOF()}
            type="button"
          >
            Créer mon OF
          </button>
        )}
      </div>

      {message && <div className="rounded-xl border bg-gray-50 p-4 text-sm">{message}</div>}

      {canInvite && (
        <div className="card space-y-3">
          <h2 className="text-lg font-medium">Inviter un formateur</h2>

          <input
            className="input w-full"
            placeholder="email du formateur"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />

          <select
            className="input w-full"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
          >
            <option value="member">Formateur</option>
            <option value="admin">Admin</option>
          </select>

          <button className="btn btn-primary w-full" onClick={() => void invite()} type="button">
            Inviter
          </button>
        </div>
      )}

      {canManageMembers && currentOrgId && (
        <div className="card space-y-2">
          <h2 className="text-sm font-medium">Membres de l’organisme</h2>

          {membersLoading ? (
            <div className="border px-3 py-1 text-[11px] text-gray-400">Chargement…</div>
          ) : members.length === 0 ? (
            <div className="border px-3 py-1 text-[11px] text-gray-400">Aucun membre</div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-4 bg-gray-50 px-3 py-0.5 text-[11px] font-medium text-gray-600">
                <div>Nom</div>
                <div>Email</div>
                <div>Rôle</div>
                <div className="text-right">Action</div>
              </div>

              {members.map((m) => {
                const fullName =
                  [m.first_name, m.last_name].filter(Boolean).join(" ") || "—";
                const disable = m.user_id === myUserId || m.role === "owner";

                return (
                  <div
                    key={m.user_id}
                    className="grid grid-cols-4 items-center border-t px-3 py-0.5 text-[11px]"
                  >
                    <div className="truncate font-medium text-gray-900">{fullName}</div>
                    <div className="truncate text-gray-600">{m.email ?? "—"}</div>
                    <div className="text-gray-600">{m.role ?? "-"}</div>

                    <div className="flex justify-end gap-2">
                      <button
                        title="Visualiser"
                        className="rounded-md border p-1 text-gray-700 hover:bg-gray-50"
                        onClick={() => {}}
                        type="button"
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        title="Modifier rôle"
                        className="rounded-md border p-1 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        disabled={disable}
                        onClick={() => openEditRole(m)}
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        title="Révoquer"
                        className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
                        disabled={disable}
                        onClick={() => revokeMember(m.user_id, `${fullName} (${m.email ?? ""})`)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Organismes (OF)</h2>

        {loading ? (
          <div className="border p-4 text-sm text-gray-400">Chargement…</div>
        ) : businessRows.length === 0 ? (
          <div className="border p-4 text-sm text-gray-400">Aucun organisme</div>
        ) : (
          businessRows.map((r) => {
            const active = r.org_id === currentOrgId;
            const canLeave = r.role !== "owner";

            return (
              <div key={r.org_id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">{r.org_name}</div>
                  <div className="text-sm text-gray-500">Rôle : {r.role ?? "-"}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    className={active ? "btn btn-secondary" : "btn btn-primary"}
                    onClick={() => void switchTo(r.org_id)}
                    disabled={active}
                    type="button"
                  >
                    {active ? "Ouvert" : "Ouvrir"}
                  </button>

                  {canLeave && (
                    <button
                      className="btn btn-danger"
                      onClick={() => void leaveOrg(r.org_id, r.org_name)}
                      type="button"
                    >
                      Quitter
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ModalShell
        title={editTitle}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditMember(null);
          setEditError(null);
        }}
      >
        {!editMember ? null : (
          <div className="space-y-4">
            {editError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="text-xs text-gray-500">Email</div>
                <div className="mt-1 text-sm font-semibold">{editMember.email ?? "—"}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Rôle</div>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  disabled={editMember.role === "owner"}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>

                <button
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
                  onClick={() => void saveRole()}
                  disabled={savingRole || editMember.role === "owner"}
                  type="button"
                >
                  {savingRole ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                onClick={() => {
                  setEditOpen(false);
                  setEditMember(null);
                  setEditError(null);
                }}
                type="button"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
