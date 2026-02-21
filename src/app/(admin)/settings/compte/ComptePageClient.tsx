"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import * as React from "react";
import { supabase } from "@/lib/supabase/browser";
import ProfileLogoUploader from "@/features/profile/ProfileLogoUploader";

type Org = {
  id: string;
  name: string | null;
  org_type: "business" | "personal" | string | null;
  logo_url?: string | null;
};

function isNoCurrentOrg(err: any) {
  return err?.message === "no_current_org" || err?.code === "P0001";
}

function getOrgLabel(m: any) {
  return (
    m?.org_name ||
    m?.organization_name ||
    m?.name ||
    m?.organizations?.name ||
    m?.org?.name ||
    m?.org_id ||
    "Organisme"
  );
}

export default function OrganismePage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const [exporting, setExporting] = React.useState(false);
  const [exportConfirmed, setExportConfirmed] = React.useState(false);
  const [exportConfirmTouched, setExportConfirmTouched] = React.useState(false);

  const [downloadingRgpdPdf, setDownloadingRgpdPdf] = React.useState(false);

  const [userId, setUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");

  const [currentOrg, setCurrentOrg] = React.useState<Org | null>(null);
  const [role, setRole] = React.useState<"owner" | "admin" | "member">("member");

  const [orgName, setOrgName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [userLogoUrl, setUserLogoUrl] = React.useState<string | null>(null);

  // ✅ Ajouts profil utilisateur
  const [phone, setPhone] = React.useState("");
  const [billingStreet, setBillingStreet] = React.useState("");
  const [billingPostalCode, setBillingPostalCode] = React.useState("");
  const [billingCity, setBillingCity] = React.useState("");
  const [billingSiret, setBillingSiret] = React.useState("");
  const [billingVat, setBillingVat] = React.useState("");

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"member" | "admin">("member");
  const [inviteSending, setInviteSending] = React.useState(false);

  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");

  const [deletePassword, setDeletePassword] = React.useState("");
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  const [deleting, setDeleting] = React.useState(false);

  // ✅ DEBUG UI activé si URL contient ?debug=1
  const debug = typeof window !== "undefined" && window.location.search.includes("debug=1");

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setMessage(userErr.message);
      setLoading(false);
      return;
    }

    const user = userData.user;
    if (!user) {
      setMessage("Non connecté");
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");
    setNewEmail(user.email ?? "");

    // 1) Profil (toujours)
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select(
        "first_name,last_name,logo_url,phone,billing_street,billing_postal_code,billing_city,billing_siret,billing_vat"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) setMessage(profErr.message);

    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setUserLogoUrl(profile?.logo_url ?? null);

    setPhone(profile?.phone ?? "");
    setBillingStreet(profile?.billing_street ?? "");
    setBillingPostalCode(profile?.billing_postal_code ?? "");
    setBillingCity(profile?.billing_city ?? "");
    setBillingSiret(profile?.billing_siret ?? "");
    setBillingVat(profile?.billing_vat ?? "");

    // 2) OF actif
    const { data: curOrgId, error: curOrgErr } = await supabase.rpc("current_org_id");

    // Si pas d'OF actif : on essaie auto-set si 1 seul OF
    if (curOrgErr || !curOrgId) {
      const { data: memData, error: memErr } = await supabase.rpc("get_my_memberships");
      const memberships = !memErr && Array.isArray(memData) ? (memData as any[]) : [];

      if (memberships.length === 1 && memberships[0]?.org_id) {
        const onlyOrgId = memberships[0].org_id;
        const { error: setErr } = await supabase.rpc("set_current_org", { p_org_id: onlyOrgId });
        if (!setErr) {
          window.dispatchEvent(new Event("fa:org_changed"));
          setLoading(false);
          return;
        }
      }

      setCurrentOrg(null);
      setOrgName("");
      setRole("member");
      setMessage("Aucun organisme actif. Sélectionne ton OF existant (ou crée-en un).");
      setLoading(false);
      return;
    }

    // 3) Charger org
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id,name,org_type,logo_url")
      .eq("id", curOrgId)
      .maybeSingle();

    if (orgErr || !org) {
      setMessage(orgErr?.message || "Org introuvable");
      setCurrentOrg(null);
      setOrgName("");
      setRole("member");
      setLoading(false);
      return;
    }

    setCurrentOrg(org as Org);
    setOrgName(org.name ?? "");

    // 4) rôle
    const { data: memData2, error: memErr2 } = await supabase.rpc("get_my_memberships");
    if (!memErr2 && Array.isArray(memData2)) {
      const m = (memData2 as any[]).find((x: any) => x.org_id === curOrgId);
      setRole((m?.role ?? "member") as any);
    } else {
      setRole("member");
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

  const isInvitedOnly = role !== "admin" && role !== "owner";
  const canEditOrg = role === "owner" || role === "admin";

  const createMyOF = async () => {
    setSaving(true);
    setMessage(null);

    const name = window.prompt("Nom de l'organisme (OF) ?");
    if (!name) {
      setSaving(false);
      return;
    }

    const { data: newOrgId, error } = await supabase.rpc("create_business_org", { p_name: name });

    if (error || !newOrgId) {
      setMessage(error?.message || "Création impossible");
      setSaving(false);
      return;
    }

    await supabase.rpc("set_current_org", { p_org_id: newOrgId });
    window.dispatchEvent(new Event("fa:org_changed"));

    setSaving(false);
    setMessage("Organisme créé ✅");
  };

  const pickMyOF = async () => {
    setSaving(true);
    setMessage(null);

    const { data: memData, error: memErr } = await supabase.rpc("get_my_memberships");
    if (memErr) {
      setMessage(memErr.message);
      setSaving(false);
      return;
    }

    const memberships = Array.isArray(memData) ? (memData as any[]) : [];
    if (memberships.length === 0) {
      setMessage("Aucun organisme trouvé pour ton compte. Demande à être invité ou crée ton OF.");
      setSaving(false);
      return;
    }

    // 1 seul -> set direct
    if (memberships.length === 1 && memberships[0]?.org_id) {
      const { error: setErr } = await supabase.rpc("set_current_org", { p_org_id: memberships[0].org_id });
      if (setErr) {
        setMessage(setErr.message);
        setSaving(false);
        return;
      }
      window.dispatchEvent(new Event("fa:org_changed"));
      setSaving(false);
      setMessage("Organisme actif sélectionné ✅");
      return;
    }

    // plusieurs -> prompt
    const lines = memberships.map((m, i) => {
      const name = getOrgLabel(m);
      const r = m?.role ?? "member";
      return `${i + 1}) ${name} (${r})`;
    });

    const choice = window.prompt("Choisis ton organisme en tapant le numéro :\n\n" + lines.join("\n"));
    const idx = Number(choice) - 1;

    if (!Number.isFinite(idx) || idx < 0 || idx >= memberships.length) {
      setMessage("Choix annulé.");
      setSaving(false);
      return;
    }

    const orgId = memberships[idx]?.org_id;
    if (!orgId) {
      setMessage("Organisme invalide (org_id manquant).");
      setSaving(false);
      return;
    }

    const { error: setErr } = await supabase.rpc("set_current_org", { p_org_id: orgId });
    if (setErr) {
      setMessage(setErr.message);
      setSaving(false);
      return;
    }

    window.dispatchEvent(new Event("fa:org_changed"));
    setSaving(false);
    setMessage("Organisme actif sélectionné ✅");
  };

 const save = async () => {
  if (!userId) return;

  setSaving(true);
  setMessage(null);

  /* =========================
     1) PROFIL — TOUJOURS
     ========================= */
  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      billing_street: billingStreet.trim() || null,
      billing_postal_code: billingPostalCode.trim() || null,
      billing_city: billingCity.trim() || null,
      billing_siret: billingSiret.trim() || null,
      billing_vat: billingVat.trim() || null,
    })
    .eq("id", userId);

  if (profErr) {
    setSaving(false);
    setMessage(profErr.message);
    return;
  }

  /* =========================
     2) ORGANISME — DIRECT
     ========================= */
  if (canEditOrg && currentOrg?.id && orgName.trim()) {
    const { error: orgErr } = await supabase
      .from("organizations")
      .update({ name: orgName.trim() })
      .eq("id", currentOrg.id);

    if (orgErr) {
      setSaving(false);
      setMessage(orgErr.message);
      return;
    }
  }

  setSaving(false);
  setMessage("Enregistré ✅");
  window.dispatchEvent(new Event("fa:org_changed"));
  await load();
};


  const sendInvite = async () => {
    if (!currentOrg?.id) return;

    setInviteSending(true);
    setMessage(null);

    const cleaned = inviteEmail.trim().toLowerCase().replace("#", "@");
    if (!cleaned) {
      setMessage("Email requis");
      setInviteSending(false);
      return;
    }

    const { error } = await supabase.rpc("create_invite", {
      p_org_id: currentOrg.id,
      p_email: cleaned,
      p_role: inviteRole,
    });

    if (error) {
      setMessage(error.message);
      setInviteSending(false);
      return;
    }

    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("member");
    setInviteSending(false);
    setMessage("Invitation créée ✅");
  };

  const changePassword = async () => {
    setMessage(null);
    if (!newPassword || newPassword !== newPassword2) {
      setMessage("Mot de passe: erreur de confirmation.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewPassword("");
    setNewPassword2("");
    setMessage("Mot de passe mis à jour ✅");
  };

  const changeEmail = async () => {
    setMessage(null);
    const e = newEmail.trim().toLowerCase();
    if (!e) {
      setMessage("Email requis");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: e });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Email mis à jour ✅ (confirmation requise)");
  };

  const downloadRgpdPdf = async () => {
    try {
      setMessage(null);
      setDownloadingRgpdPdf(true);

      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw new Error(sErr.message);
      const token = s?.session?.access_token;
      if (!token) throw new Error("Session introuvable (token manquant)");

      const res = await fetch("/api/rgpd/document", {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          Authorization: `Bearer ${token}`,
        },
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/pdf")) {
        const txt = await res.text().catch(() => "");
        throw new Error(`RGPD PDF ERROR: HTTP ${res.status} CT=${ct} ${txt}`.slice(0, 500));
      }

      const cd = res.headers.get("content-disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const fallback = `rgpd-document-${new Date().toISOString().slice(0, 10)}.pdf`;
      const filename = m?.[1] || fallback;

      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error("RGPD PDF ERROR: blob vide");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);

      setMessage("Document RGPD (PDF) téléchargé ✅");
    } catch (e: any) {
      setMessage(e?.message ?? String(e));
    } finally {
      setDownloadingRgpdPdf(false);
    }
  };

  const exportRgpdExcel = async () => {
    try {
      setMessage(null);
      setExporting(true);

      const { data, error } = await supabase.rpc("get_my_rgpd_export");

      if (error) {
        setExporting(false);
        setMessage(error.message);
        return;
      }

      const XLSX = await import("xlsx");

      const d: any = data ?? {};
      const yyyy_mm_dd = new Date().toISOString().slice(0, 10);
      const filename = `rgpd-export-${yyyy_mm_dd}.xlsx`;

      const wb = XLSX.utils.book_new();
      const toRows = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ generated_at: d.generated_at ?? null, user_id: d.user_id ?? null, email: d.email ?? null }]),
        "meta"
      );

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.legal_notice)), "legal_notice");

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(Array.isArray(d.retention_by_table) ? d.retention_by_table : []),
        "retention_policy"
      );

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.auth)), "auth");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.profile)), "profile");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.memberships)), "memberships");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.organizations)), "organizations");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.sessions_created)), "sessions_created");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.invoices_created)), "invoices_created");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.invitations)), "invitations");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.access_notifications)), "access_notifications");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(d.access_history)), "access_history");

      setExporting(false);
      XLSX.writeFile(wb, filename);

      setExportConfirmed(true);
      setExportConfirmTouched(false);
      setMessage("Export RGPD Excel téléchargé ✅");
    } catch (e: any) {
      setExporting(false);
      setMessage(e?.message ?? String(e));
    }
  };

  const deleteAccount = async () => {
    setMessage(null);

    if (!exportConfirmed) {
      setExportConfirmTouched(true);
      setMessage('Export RGPD requis avant suppression. Clique sur "Exporter mes données (Excel)" puis coche la case.');
      return;
    }

    if (deleteConfirmText !== "SUPPRIMER") {
      setMessage('Tape "SUPPRIMER" pour confirmer.');
      return;
    }

    const ok = window.confirm(
      "Confirmer la suppression ?\n\nCela retire tes accès + anonymise ton profil + bloque la connexion."
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const { error } = await supabase.rpc("delete_my_account");
      if (error) {
        setDeleting(false);
        setMessage(error.message);
        return;
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: any) {
      setDeleting(false);
      setMessage(e?.message ?? String(e));
    }
  };

  const disabledAll = loading || saving || deleting || exporting || downloadingRgpdPdf;

  const showOrgCard = !!currentOrg;
  const showNoOrgCard = !isInvitedOnly && !currentOrg;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mon compte</h1>
          <p className="text-sm text-gray-500">Profil utilisateur et organisme</p>
        </div>

        <div className="flex gap-2">
          {canEditOrg && !isInvitedOnly && currentOrg && (
            <button className="btn btn-secondary" onClick={() => setInviteOpen(true)} disabled={disabledAll} type="button">
              + Inviter
            </button>
          )}

          {!isInvitedOnly && (
            <button className="btn btn-primary" onClick={() => void save()} disabled={disabledAll} type="button">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border bg-gray-50 p-4 text-sm font-medium text-gray-700">{message}</div>}

      {/* ✅ DEBUG BOX */}
      {debug && (
        <div className="rounded-xl border bg-white p-4 text-xs">
          <div><b>DEBUG</b></div>
          <div>userId: {userId ?? "null"}</div>
          <div>currentOrg(state): {currentOrg?.id ?? "null"}</div>
          <div>role: {role}</div>

          <button
            className="btn btn-secondary mt-2"
            type="button"
            disabled={disabledAll}
            onClick={async () => {
              const a = await supabase.rpc("current_org_id");
              const b = await supabase.rpc("get_my_memberships");
              const c = await supabase.auth.getSession();
              setMessage(
                "DEBUG current_org_id=" +
                  JSON.stringify(a) +
                  "\nDEBUG get_my_memberships=" +
                  JSON.stringify(b) +
                  "\nDEBUG session=" +
                  JSON.stringify({ hasSession: !!c.data?.session, userId: c.data?.session?.user?.id ?? null })
              );
            }}
          >
            DEBUG: afficher memberships
          </button>
        </div>
      )}

      {isInvitedOnly ? (
        <div className="card space-y-4">
          <h2 className="text-lg font-medium">Vous êtes utilisateur invité</h2>
          <p className="text-sm text-gray-500">Vous ne pouvez pas gérer cet OF. Créez votre propre OF pour continuer.</p>
          <button className="btn btn-primary" onClick={() => void createMyOF()} disabled={disabledAll} type="button">
            {saving ? "Création..." : "Créer mon OF"}
          </button>
        </div>
      ) : (
        <>
          <div className="card space-y-4">
            <h2 className="text-lg font-medium">Mon profil</h2>

            <ProfileLogoUploader
              initialUrl={userLogoUrl}
              onSaved={(url) => {
                setUserLogoUrl(url);
                window.dispatchEvent(new Event("fa:org_changed"));
              }}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input className="input" placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={disabledAll} />
              <input className="input" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={disabledAll} />
            </div>

            <input className="input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabledAll} />

            <div className="space-y-2 pt-2">
              <div className="text-sm font-medium">Infos de facturation</div>

              <input className="input" placeholder="Rue" value={billingStreet} onChange={(e) => setBillingStreet(e.target.value)} disabled={disabledAll} />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input className="input" placeholder="Code postal" value={billingPostalCode} onChange={(e) => setBillingPostalCode(e.target.value)} disabled={disabledAll} />
                <input className="input" placeholder="Ville" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} disabled={disabledAll} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input className="input" placeholder="N° SIRET" value={billingSiret} onChange={(e) => setBillingSiret(e.target.value)} disabled={disabledAll} />
                <input className="input" placeholder="N° TVA" value={billingVat} onChange={(e) => setBillingVat(e.target.value)} disabled={disabledAll} />
              </div>
            </div>

            <input className="input" value={email} disabled />
          </div>

          {showNoOrgCard && (
            <div className="card space-y-4">
              <h2 className="text-lg font-medium">Organisme</h2>
              <p className="text-sm text-gray-500">Aucun organisme actif. Sélectionne ton OF existant (ou crée-en un).</p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="btn btn-primary" onClick={() => void pickMyOF()} disabled={disabledAll} type="button">
                  {saving ? "Chargement..." : "Choisir mon OF existant"}
                </button>

                <button className="btn btn-secondary" onClick={() => void createMyOF()} disabled={disabledAll} type="button">
                  {saving ? "Création..." : "Créer mon OF"}
                </button>
              </div>
            </div>
          )}

          {showOrgCard && (
            <div className="card space-y-4">
              <h2 className="text-lg font-medium">Organisme</h2>

              <input
                className="input"
                placeholder="Nom de l’organisme"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={disabledAll || !canEditOrg}
              />

              <div className="text-sm text-gray-500">
                Type : <b>{currentOrg?.org_type}</b> — Rôle : <b>{role}</b>
              </div>
            </div>
          )}

          <div className="card space-y-4">
            <h2 className="text-lg font-medium">Sécurité du compte</h2>

            <div className="space-y-2">
              <div className="text-sm font-medium">Changer mot de passe</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input className="input" type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={disabledAll} />
                <input className="input" type="password" placeholder="Confirmer" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} disabled={disabledAll} />
              </div>
              <button className="btn btn-secondary" onClick={() => void changePassword()} type="button" disabled={disabledAll}>
                Mettre à jour le mot de passe
              </button>
            </div>

            <div className="h-px bg-gray-100" />

            <div className="space-y-2">
              <div className="text-sm font-medium">Changer email</div>
              <input className="input" placeholder="nouveau@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} disabled={disabledAll} />
              <button className="btn btn-secondary" onClick={() => void changeEmail()} type="button" disabled={disabledAll}>
                Mettre à jour l’email
              </button>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-medium">Mes données personnelles</h2>
            <p className="text-sm text-gray-500">Télécharger une copie de vos données personnelles conformément au RGPD.</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button className="btn btn-secondary" type="button" onClick={() => void exportRgpdExcel()} disabled={disabledAll}>
                {exporting ? "Export..." : "Exporter mes données (Excel)"}
              </button>

              <button className="btn btn-secondary" type="button" onClick={() => void downloadRgpdPdf()} disabled={disabledAll}>
                {downloadingRgpdPdf ? "Téléchargement..." : "Télécharger le document RGPD (PDF)"}
              </button>
            </div>

            <label
              className={[
                "flex items-center gap-2 text-sm",
                exportConfirmTouched && !exportConfirmed ? "text-red-700" : "text-slate-700",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={exportConfirmed}
                onChange={(e) => {
                  setExportConfirmed(e.target.checked);
                  setExportConfirmTouched(true);
                }}
                className={["h-4 w-4", exportConfirmTouched && !exportConfirmed ? "accent-red-600" : ""].join(" ")}
              />
              J’ai bien exporté mes données (RGPD)
            </label>

            {exportConfirmTouched && !exportConfirmed && <div className="text-sm text-red-700">Coche cette case après avoir exporté.</div>}
          </div>

          <div className="card space-y-4 border-red-200">
            <h2 className="text-lg font-medium text-red-700">Supprimer mon compte</h2>

            <input className="input" placeholder='Tape "SUPPRIMER"' value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} disabled={disabledAll} />
            <input className="input" type="password" placeholder="Mot de passe (optionnel)" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} disabled={disabledAll} />

            <button className="btn btn-danger" onClick={() => void deleteAccount()} type="button" disabled={disabledAll || !exportConfirmed}>
              {deleting ? "Suppression..." : "Supprimer définitivement"}
            </button>
          </div>
        </>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Inviter un utilisateur</h3>
              <button className="btn btn-secondary" onClick={() => setInviteOpen(false)} type="button">
                Fermer
              </button>
            </div>

            <input className="input" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemple.com" />

            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
              <option value="member">Utilisateur</option>
              <option value="admin">Admin</option>
            </select>

            <button className="btn btn-primary w-full" onClick={() => void sendInvite()} disabled={inviteSending || disabledAll} type="button">
              {inviteSending ? "Envoi..." : "Envoyer l’invitation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
