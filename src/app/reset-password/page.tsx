// src/app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = loading || !password || password !== password2;

  const updatePassword = async () => {
    if (!password) {
      alert("Entre un nouveau mot de passe.");
      return;
    }

    if (password !== password2) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    alert("Mot de passe modifié.");
    setLoading(false);
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="text-2xl font-semibold text-slate-900">
          Nouveau mot de passe
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Choisis un nouveau mot de passe pour accéder à ton compte.
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-slate-600">
              Nouveau mot de passe
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-sm font-medium text-slate-600">
              Confirmer le mot de passe
            </div>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
            />
          </div>

          {password2 && password !== password2 && (
            <div className="text-sm text-red-600">
              Les mots de passe ne correspondent pas.
            </div>
          )}

          <button
            onClick={updatePassword}
            disabled={disabled}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </button>
        </div>
      </div>
    </div>
  );
}