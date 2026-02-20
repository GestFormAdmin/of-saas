"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AccountType = "of" | "indep";

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // infos requises à l’inscription
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // choix OF / indépendant (uniquement si NON invité)
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  // si l’utilisateur arrive depuis un lien d’invitation
  const [isInvitedFromLink, setIsInvitedFromLink] = useState(false);

  const [loading, setLoading] = useState(false);

  const resetPasswords = () => {
    setPassword("");
    setPassword2("");
  };

  const resetSignupInfos = () => {
    setFirstName("");
    setLastName("");
    setLogoUrl("");
    setAccountType(null);
    setIsInvitedFromLink(false);
    setEmailLocked(false);
  };

  const persistPendingProfile = () => {
    try {
      localStorage.setItem(
        "pending_profile",
        JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          logoUrl: logoUrl.trim(),
          accountType,
          isInvitedFromLink,
          email: email.trim().toLowerCase(),
        })
      );
    } catch {}
  };

  const readPendingProfile = () => {
    try {
      const raw = localStorage.getItem("pending_profile");
      if (!raw) return;
      const p = JSON.parse(raw);
      setFirstName(p?.firstName ?? "");
      setLastName(p?.lastName ?? "");
      setLogoUrl(p?.logoUrl ?? "");
      setAccountType((p?.accountType as AccountType) ?? null);
      setIsInvitedFromLink(!!p?.isInvitedFromLink);
      if (p?.email) setEmail(p.email);
    } catch {}
  };

  // ✅ préremplir l’email depuis lien d’invitation
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qs = url.searchParams;

      const rawEmail =
        qs.get("email") || qs.get("invite_email") || qs.get("e") || "";

      if (rawEmail) {
        const cleaned = decodeURIComponent(rawEmail).trim().toLowerCase().replace("#", "@");
        setEmail(cleaned);
        setEmailLocked(true);
        setIsInvitedFromLink(true);
        setMode("signup");
        resetPasswords();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.href = "/dashboard";
    })();
  }, []);

  useEffect(() => {
    if (mode === "signup") readPendingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const signupDisabled =
    loading ||
    !email ||
    !password ||
    password !== password2 ||
    !firstName.trim() ||
    !lastName.trim() ||
    (!isInvitedFromLink && !accountType);

  const loginDisabled = loading || !email || !password;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">
              {mode === "login" ? "Connexion" : "Créer un compte"}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {mode === "login"
                ? "Connecte-toi pour accéder à l’admin."
                : isInvitedFromLink
                ? "Invitation détectée : complète ton profil."
                : "Inscris-toi pour créer ton compte."}
            </div>
          </div>

          <button
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => {
              const next = mode === "login" ? "signup" : "login";
              setMode(next);
              resetPasswords();
              if (next === "login") resetSignupInfos();
            }}
            type="button"
          >
            {mode === "login" ? "S’inscrire" : "Se connecter"}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              {/* ✅ choix OF / indépendant (pas si invité) */}
              {!isInvitedFromLink && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">Vous êtes *</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType("of")}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50 ${
                        accountType === "of" ? "border-gray-400" : "border-gray-200"
                      }`}
                    >
                      Organisme de formation
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("indep")}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50 ${
                        accountType === "indep" ? "border-gray-400" : "border-gray-200"
                      }`}
                    >
                      Formateur indépendant
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-gray-500">Prénom *</div>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    autoComplete="given-name"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-gray-500">Nom *</div>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-gray-500">Logo (option)</div>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  autoComplete="url"
                />
              </div>

              <div className="h-px bg-gray-100" />
            </>
          )}

          <div className="space-y-1">
            <div className="text-sm text-gray-500">Email</div>
            <input
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300 disabled:bg-gray-50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domaine.com"
              autoComplete="email"
              disabled={emailLocked}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-gray-500">Mot de passe</div>
            <input
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-1">
              <div className="text-sm text-gray-500">Confirmer le mot de passe</div>
              <input
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-300"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••••"
                type="password"
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
            disabled={mode === "login" ? loginDisabled : signupDisabled}
            onClick={async () => {
              setLoading(true);

              if (mode === "login") {
                const { data, error } = await supabase.auth.signInWithPassword({
                  email: email.trim().toLowerCase(),
                  password,
                });

                if (error) {
                  alert(error.message);
                  setLoading(false);
                  return;
                }

                if (!data.user?.email_confirmed_at) {
                  alert("Merci de vérifier votre email avant de vous connecter.");
                  await supabase.auth.signOut();
                  setLoading(false);
                  return;
                }

                setLoading(false);
                window.location.href = "/dashboard";
                return;
              }

              // signup
              if (!firstName.trim() || !lastName.trim()) {
                alert("Prénom + Nom requis.");
                setLoading(false);
                return;
              }

              if (!isInvitedFromLink && !accountType) {
                alert("Choisis : OF ou Indépendant.");
                setLoading(false);
                return;
              }

              persistPendingProfile();

              const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
              });

              if (error) {
                alert(error.message);
                setLoading(false);
                return;
              }

              // confirmation email ON => pas de session
              if (!data.session) {
                alert("Compte créé. Vérifie ton email pour activer ton compte.");
                setMode("login");
                resetPasswords();
                setLoading(false);
                return;
              }

              // session directe
              if (!data.user?.email_confirmed_at) {
                alert("Merci de vérifier votre email avant de continuer.");
                await supabase.auth.signOut();
                setMode("login");
                setLoading(false);
                return;
              }

              // ✅ profil minimal si invité, sinon profil + type
              if (isInvitedFromLink) {
                const { error: e2 } = await supabase.rpc("complete_profile_minimal", {
                  p_first_name: firstName.trim(),
                  p_last_name: lastName.trim(),
                  p_logo_url: logoUrl.trim() || null,
                });
                if (e2) {
                  alert(e2.message);
                  setLoading(false);
                  return;
                }
              } else {
                const { error: e2 } = await supabase.rpc("complete_profile_and_type", {
                  p_account_type: accountType,
                  p_first_name: firstName.trim(),
                  p_last_name: lastName.trim(),
                  p_logo_url: logoUrl.trim() || null,
                });
                if (e2) {
                  alert(e2.message);
                  setLoading(false);
                  return;
                }
              }

              try {
                localStorage.removeItem("pending_profile");
              } catch {}

              await supabase.rpc("accept_my_pending_invites");

              setLoading(false);
              window.location.href = "/settings/acces";
            }}
          >
            {loading
              ? mode === "login"
                ? "Connexion..."
                : "Création..."
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>

          {mode === "signup" && password !== password2 && password2 && (
            <div className="text-sm text-red-600">Les mots de passe ne correspondent pas.</div>
          )}

          {mode === "signup" && (!firstName.trim() || !lastName.trim()) && (
            <div className="text-xs text-gray-500">* Prénom et Nom requis pour créer le compte.</div>
          )}

          {mode === "signup" && !isInvitedFromLink && !accountType && (
            <div className="text-xs text-gray-500">* Choix requis : OF ou Indépendant.</div>
          )}
        </div>
      </div>
    </div>
  );
}
