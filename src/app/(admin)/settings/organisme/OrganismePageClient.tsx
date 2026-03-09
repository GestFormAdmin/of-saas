"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import * as React from "react";
import { supabase } from "@/lib/supabase/browser";
import ProfileLogoUploader from "@/features/profile/ProfileLogoUploader";

export default function MonComptePage() {
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

  // Organisme
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [orgName, setOrgName] = React.useState("");
  const [orgNdaNumber, setOrgNdaNumber] = React.useState("");
  const [orgBillingStreet, setOrgBillingStreet] = React.useState("");
  const [orgBillingPostalCode, setOrgBillingPostalCode] = React.useState("");
  const [orgBillingCity, setOrgBillingCity] = React.useState("");
  const [orgBillingSiret, setOrgBillingSiret] = React.useState("");

  // Sécurité
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");

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

    const { data: curOrgId, error: curOrgErr } = await supabase.rpc("current_org_id");
    if (curOrgErr) {
      setMessage(curOrgErr.message);
      setLoading(false);
      return;
    }

    if (curOrgId) {
      setOrgId(curOrgId);

      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .select(
          "name, nda_number, billing_street, billing_postal_code, billing_city, billing_siret"
        )
        .eq("id", curOrgId)
        .maybeSingle();

      if (orgErr) {
        setMessage(orgErr.message);
        setLoading(false);
        return;
      }

      setOrgName(org?.name ?? "");
      setOrgNdaNumber((org as any)?.nda_number ?? "");
      setOrgBillingStreet((org as any)?.billing_street ?? "");
      setOrgBillingPostalCode((org as any)?.billing_postal_code ?? "");
      setOrgBillingCity((org as any)?.billing_city ?? "");
      setOrgBillingSiret((org as any)?.billing_siret ?? "");
    } else {
      setOrgId(null);
      setOrgName("");
      setOrgNdaNumber("");
      setOrgBillingStreet("");
      setOrgBillingPostalCode("");
      setOrgBillingCity("");
      setOrgBillingSiret("");
    }

    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

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
      })
      .eq("id", userId);

    setSavingProfile(false);
    setMessage(error ? error.message : "Profil enregistré ✅");
  };

  const saveOrg = async () => {
    if (!orgId || !orgName.trim()) return;

    setSavingOrg(true);
    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({
        name: orgName.trim(),
        nda_number: orgNdaNumber.trim() || null,
        billing_street: orgBillingStreet.trim() || null,
        billing_postal_code: orgBillingPostalCode.trim() || null,
        billing_city: orgBillingCity.trim() || null,
        billing_siret: orgBillingSiret.trim() || null,
      })
      .eq("id", orgId);

    setSavingOrg(false);
    setMessage(error ? error.message : "Organisme enregistré ✅");
  };

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
    setOrgNdaNumber("");
    setOrgBillingStreet("");
    setOrgBillingPostalCode("");
    setOrgBillingCity("");
    setOrgBillingSiret("");
    setMessage("Organisme supprimé ✅");
    await load();
  };

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <button className="btn btn-primary" onClick={saveProfile} disabled={disabled}>
          {savingProfile ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      {message && <div className="rounded-xl border p-4 text-sm">{message}</div>}

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Profil</h2>

        <ProfileLogoUploader initialUrl={userLogoUrl} onSaved={setUserLogoUrl} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            className="input"
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <input
          className="input"
          placeholder="Téléphone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input className="input" value={email} disabled />
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Exporter mes données</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => void exportMyData("xlsx")}
            disabled={disabled}
          >
            {exportingXlsx ? "Export Excel..." : "Exporter (Excel)"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void exportMyData("csv")}
            disabled={disabled}
          >
            {exportingCsv ? "Export CSV..." : "Exporter (CSV)"}
          </button>
        </div>
        <div className="text-xs opacity-70">
          Exporte : profil, sessions, apprenants, clients, produits, factures/devis, dépenses…
          (selon tes accès).
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-medium">Organisme</h2>

        <input
          className="input"
          placeholder="Nom de l’organisme"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            className="input"
            placeholder="Numéro NDA"
            value={orgNdaNumber}
            onChange={(e) => setOrgNdaNumber(e.target.value)}
          />
          <input
            className="input"
            placeholder="Numéro SIRET"
            value={orgBillingSiret}
            onChange={(e) => setOrgBillingSiret(e.target.value)}
          />
        </div>

        <input
          className="input"
          placeholder="Adresse de facturation"
          value={orgBillingStreet}
          onChange={(e) => setOrgBillingStreet(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            className="input"
            placeholder="Code postal"
            value={orgBillingPostalCode}
            onChange={(e) => setOrgBillingPostalCode(e.target.value)}
          />
          <input
            className="input"
            placeholder="Ville"
            value={orgBillingCity}
            onChange={(e) => setOrgBillingCity(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={saveOrg}
            disabled={!orgId || savingOrg || disabled}
          >
            {savingOrg ? "Sauvegarde..." : "Enregistrer l’organisme"}
          </button>

          <button
            className="btn btn-danger"
            onClick={deleteOrg}
            disabled={!orgId || deletingOrg || disabled}
          >
            {deletingOrg ? "Suppression..." : "Supprimer l’organisme"}
          </button>
        </div>
      </div>

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

      <div className="card space-y-4 border-red-200">
        <h2 className="text-lg font-medium text-red-700">Supprimer le compte</h2>
        <button className="btn btn-danger" onClick={deleteAccount} disabled={disabled}>
          {deletingAccount ? "Suppression..." : "Supprimer définitivement mon compte"}
        </button>
      </div>
    </div>
  );
}