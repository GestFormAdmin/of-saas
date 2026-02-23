"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import * as React from "react";
import { supabase } from "@/lib/supabase/browser";
import ProfileLogoUploader from "@/features/profile/ProfileLogoUploader";

export default function MonComptePage() {
  /* ======================
     STATES
     ====================== */
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingOrg, setSavingOrg] = React.useState(false);
  const [deletingOrg, setDeletingOrg] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);

  const [exportingXlsx, setExportingXlsx] = React.useState(false);
  const [exportingCsv, setExportingCsv] = React.useState(false);

  const [userId, setUserId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");

  // Profil
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [userLogoUrl, setUserLogoUrl] = React.useState<string | null>(null);

  // Facturation
  const [billingStreet, setBillingStreet] = React.useState("");
  const [billingPostalCode, setBillingPostalCode] = React.useState("");
  const [billingCity, setBillingCity] = React.useState("");
  const [billingSiret, setBillingSiret] = React.useState("");
  const [billingVat, setBillingVat] = React.useState("");

  // Organisme
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [orgName, setOrgName] = React.useState("");

  // Sécurité
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");

  /* ======================
     LOAD
     ====================== */
  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) {
      setMessage("Non connecté");
      setLoading(false);
      return;
    }

    setUserId(u.user.id);
    setEmail(u.user.email ?? "");
    setNewEmail(u.user.email ?? "");

    // Profil
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.user.id)
      .maybeSingle();

    if (pErr) {
      setMessage(pErr.message);
      setLoading(false);
      return;
    }

    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setPhone(profile?.phone ?? "");
    setUserLogoUrl(profile?.logo_url ?? null);

    setBillingStreet(profile?.billing_street ?? "");
    setBillingPostalCode(profile?.billing_postal_code ?? "");
    setBillingCity(profile?.billing_city ?? "");
    setBillingSiret(profile?.billing_siret ?? "");
    setBillingVat(profile?.billing_vat ?? "");

    // Organisme actif
    const { data: curOrgId } = await supabase.rpc("current_org_id");
    if (curOrgId) {
      setOrgId(curOrgId);
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", curOrgId)
        .maybeSingle();
      setOrgName(org?.name ?? "");
    } else {
      setOrgId(null);
      setOrgName("");
    }

    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

  /* ======================
     EXPORT "MES DONNÉES"
     ====================== */
  const downloadBlob = async (res: Response, filename: string) => {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportMyData = async (format: "xlsx" | "csv") => {
    try {
      setMessage(null);
      if (format === "xlsx") setExportingXlsx(true);
      else setExportingCsv(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setMessage("Non connecté");
        return;
      }

      const res = await fetch(`/api/export/me?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setMessage(txt || "Export impossible");
        return;
      }

      if (format === "xlsx") {
        await downloadBlob(res, "export-mes-donnees.xlsx");
        setMessage("Export Excel généré ✅");
      } else {
        await downloadBlob(res, "export-mes-donnees-csv.zip");
        setMessage("Export CSV généré ✅");
      }
    } finally {
      setExportingXlsx(false);
      setExportingCsv(false);
    }
  };

  /* ======================
     SAVE PROFIL
     ====================== */
  const saveProfile = async () => {
    if (!userId) return;

    setSavingProfile(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        billing_street: billingStreet || null,
        billing_postal_code: billingPostalCode || null,
        billing_city: billingCity || null,
        billing_siret: billingSiret || null,
        billing_vat: billingVat || null,
      })
      .eq("id", userId);

    setSavingProfile(false);
    setMessage(error ? error.message : "Profil enregistré ✅");
  };

  /* ======================
     SAVE ORGANISME
     ====================== */
  const saveOrg = async () => {
    if (!orgId || !orgName.trim()) return;

    setSavingOrg(true);
    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName.trim() })
      .eq("id", orgId);

    setSavingOrg(false);
    setMessage(error ? error.message : "Organisme enregistré ✅");
  };

  /* ======================
     DELETE ORGANISME
     ====================== */
  const deleteOrg = async () => {
    if (!orgId) return;
    if (!confirm("Supprimer définitivement cet organisme (OF) ?")) return;

    setDeletingOrg(true);
    setMessage(null);

    const { error } = await supabase.from("organizations").delete().eq("id", orgId);

    setDeletingOrg(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setOrgId(null);
    setOrgName("");
    setMessage("Organisme supprimé ✅");
    await load();
  };

  /* ======================
     SECURITY
     ====================== */
  const changeEmail = async () => {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setMessage(error ? error.message : "Email mis à jour (confirmation requise) ✅");
  };

  const changePassword = async () => {
    if (!newPassword || newPassword !== newPassword2) {
      setMessage("Erreur de confirmation du mot de passe");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : "Mot de passe mis à jour ✅");
  };

  /* ======================
     DELETE ACCOUNT
     ====================== */
  const deleteAccount = async () => {
    if (!confirm("Supprimer définitivement ton compte ?")) return;

    setDeletingAccount(true);
    setMessage(null);

    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeletingAccount(false);
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const disabled =
    loading ||
    savingProfile ||
    savingOrg ||
    deletingOrg ||
    deletingAccount ||
    exportingXlsx ||
    exportingCsv;

  /* ======================
     UI
     ====================== */
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <button className="btn btn-primary" onClick={saveProfile} disabled={disabled}>
          {savingProfile ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      {message && <div className="rounded-xl border p-4 text-sm">{message}</div>}

      {/* PROFIL */}
      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Profil</h2>

        <ProfileLogoUploader initialUrl={userLogoUrl} onSaved={setUserLogoUrl} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input" placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="input" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>

        <input className="input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <input className="input" value={email} disabled />
      </div>

      {/* EXPORT "MES DONNÉES" */}
      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Exporter mes données</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => void exportMyData("xlsx")} disabled={disabled}>
            {exportingXlsx ? "Export Excel..." : "Exporter (Excel)"}
          </button>
          <button className="btn btn-secondary" onClick={() => void exportMyData("csv")} disabled={disabled}>
            {exportingCsv ? "Export CSV..." : "Exporter (CSV)"}
          </button>
        </div>
        <div className="text-xs opacity-70">
          Exporte : profil, sessions, apprenants, clients, produits, factures/devis, dépenses… (selon tes accès).
        </div>
      </div>

      {/* ORGANISME */}
      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Organisme</h2>

        <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />

        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={saveOrg} disabled={!orgId || savingOrg || disabled}>
            {savingOrg ? "Sauvegarde..." : "Enregistrer l’organisme"}
          </button>

          <button className="btn btn-danger" onClick={deleteOrg} disabled={!orgId || deletingOrg || disabled}>
            {deletingOrg ? "Suppression..." : "Supprimer l’organisme"}
          </button>
        </div>
      </div>

      {/* SÉCURITÉ */}
      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Sécurité du compte</h2>

        <input className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <button className="btn btn-secondary" onClick={changeEmail} disabled={disabled}>
          Modifier l’email
        </button>

        <input
          className="input"
          type="password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Confirmation"
          value={newPassword2}
          onChange={(e) => setNewPassword2(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={changePassword} disabled={disabled}>
          Modifier le mot de passe
        </button>
      </div>

      {/* SUPPRESSION COMPTE */}
      <div className="card border-red-200 space-y-4">
        <h2 className="text-lg font-medium text-red-700">Supprimer le compte</h2>
        <button className="btn btn-danger" onClick={deleteAccount} disabled={disabled}>
          {deletingAccount ? "Suppression..." : "Supprimer définitivement mon compte"}
        </button>
      </div>
    </div>
  );
}