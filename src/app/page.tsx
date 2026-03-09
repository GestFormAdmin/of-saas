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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [accountType, setAccountType] = useState<AccountType | null>(null);
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

  const resetPassword = async () => {
    if (!email.trim()) {
      alert("Entre ton email pour recevoir le lien de réinitialisation.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    alert("Email de réinitialisation envoyé.");
  };

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qs = url.searchParams;

      const rawEmail =
        qs.get("email") || qs.get("invite_email") || qs.get("e") || "";

      if (rawEmail) {
        const cleaned = decodeURIComponent(rawEmail)
          .trim()
          .toLowerCase()
          .replace("#", "@");
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/35 to-slate-950/55" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
              FormaTalent
            </div>

            <div className="mt-8 max-w-xl">
              <h1 className="text-5xl font-semibold leading-tight tracking-tight text-white xl:text-6xl">
                Gérez et développez votre activité de formation
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/80 xl:text-lg">
                Sessions, apprenants, clients, dépenses, devis et factures dans
                une interface claire pensée pour les organismes de formation et
                les formateurs indépendants.
              </p>
            </div>
          </div>

          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-sm text-white/70">Sessions à venir</div>
              <div className="mt-2 text-3xl font-semibold text-white">17</div>
              <div className="mt-1 text-sm text-white/65">
                Vue planning claire
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-sm text-white/70">CA suivi</div>
              <div className="mt-2 text-3xl font-semibold text-white">
                12 576 €
              </div>
              <div className="mt-1 text-sm text-white/65">
                Devis & factures
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-sm text-white/70">Apprenants</div>
              <div className="mt-2 text-3xl font-semibold text-white">111</div>
              <div className="mt-1 text-sm text-white/65">
                Suivi centralisé
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="text-sm text-white/70">Dépenses</div>
              <div className="mt-2 text-3xl font-semibold text-white">
                2 949 €
              </div>
              <div className="mt-1 text-sm text-white/65">Pilotage simple</div>
            </div>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center p-5 sm:p-8 lg:justify-end lg:p-10 xl:p-14">
          <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/88 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900">
                  {mode === "login" ? "Connexion" : "Créer un compte"}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  {mode === "login"
                    ? "Connecte-toi pour accéder à ton espace."
                    : isInvitedFromLink
                    ? "Invitation détectée : complète ton profil."
                    : "Crée ton compte pour démarrer."}
                </div>
              </div>

              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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

            <div className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  {!isInvitedFromLink && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-600">
                        Vous êtes *
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountType("of")}
                          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                            accountType === "of"
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Organisme de formation
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType("indep")}
                          className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                            accountType === "indep"
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Formateur indépendant
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-slate-600">
                        Prénom *
                      </div>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Prénom"
                        autoComplete="given-name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-slate-600">
                        Nom *
                      </div>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Nom"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-slate-600">
                      Logo (option)
                    </div>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://..."
                      autoComplete="url"
                    />
                  </div>

                  <div className="h-px bg-slate-200" />
                </>
              )}

              <div className="space-y-1.5">
                <div className="text-sm font-medium text-slate-600">Email</div>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 disabled:bg-slate-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@domaine.com"
                  autoComplete="email"
                  disabled={emailLocked}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-medium text-slate-600">
                  Mot de passe
                </div>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <div className="text-sm font-medium text-slate-600">
                    Confirmer le mot de passe
                  </div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••••"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button
                className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={mode === "login" ? loginDisabled : signupDisabled}
                onClick={async () => {
                  setLoading(true);

                  if (mode === "login") {
                    const { data, error } =
                      await supabase.auth.signInWithPassword({
                        email: email.trim().toLowerCase(),
                        password,
                      });

                    if (error) {
                      alert(error.message);
                      setLoading(false);
                      return;
                    }

                    if (!data.user?.email_confirmed_at) {
                      alert(
                        "Merci de vérifier votre email avant de vous connecter."
                      );
                      await supabase.auth.signOut();
                      setLoading(false);
                      return;
                    }

                    setLoading(false);
                    window.location.href = "/dashboard";
                    return;
                  }

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

                  if (!data.session) {
                    alert(
                      "Compte créé. Vérifie ton email pour activer ton compte."
                    );
                    setMode("login");
                    resetPasswords();
                    setLoading(false);
                    return;
                  }

                  if (!data.user?.email_confirmed_at) {
                    alert("Merci de vérifier votre email avant de continuer.");
                    await supabase.auth.signOut();
                    setMode("login");
                    setLoading(false);
                    return;
                  }

                  if (isInvitedFromLink) {
                    const { error: e2 } = await supabase.rpc(
                      "complete_profile_minimal",
                      {
                        p_first_name: firstName.trim(),
                        p_last_name: lastName.trim(),
                        p_logo_url: logoUrl.trim() || null,
                      }
                    );
                    if (e2) {
                      alert(e2.message);
                      setLoading(false);
                      return;
                    }
                  } else {
                    const { error: e2 } = await supabase.rpc(
                      "complete_profile_and_type",
                      {
                        p_account_type: accountType,
                        p_first_name: firstName.trim(),
                        p_last_name: lastName.trim(),
                        p_logo_url: logoUrl.trim() || null,
                      }
                    );
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

              {mode === "login" && (
                <div className="mt-3 text-center">
                  <button
                    onClick={resetPassword}
                    className="text-sm text-slate-600 underline transition hover:text-slate-900"
                    type="button"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              {mode === "signup" && password !== password2 && password2 && (
                <div className="text-sm text-red-600">
                  Les mots de passe ne correspondent pas.
                </div>
              )}

              {mode === "signup" && (!firstName.trim() || !lastName.trim()) && (
                <div className="text-xs text-slate-500">
                  * Prénom et Nom requis pour créer le compte.
                </div>
              )}

              {mode === "signup" && !isInvitedFromLink && !accountType && (
                <div className="text-xs text-slate-500">
                  * Choix requis : OF ou Indépendant.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}