// src/app/onboarding/OnboardingClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { authUi as uiRaw } from "@/lib/ui";
import BlueAuthShell from "@/components/BlueAuthShell";

const ui: any = uiRaw;

type Mode = "business" | "personal";

export default function OnboardingClient() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("business");

  // business only
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    return mode === "business" ? "Bienvenue 👋" : "Bienvenue 👋";
  }, [mode]);

  const subtitle = useMemo(() => {
    return mode === "business"
      ? "Veuillez créer votre organisme pour accéder à l'application"
      : "Activez votre espace personnel pour accéder à l'application";
  }, [mode]);

  async function createBusinessOrg() {
    if (!name.trim()) {
      setError("Nom requis");
      return;
    }

    setLoading(true);
    setError(null);

    const orgName = name.trim();

    const { data, error: e1 } = await supabase.rpc("create_business_org", {
      p_name: orgName,
    });

    if (e1 || !data) {
      setError(e1?.message || "Création impossible");
      setLoading(false);
      return;
    }

    const { error: e2 } = await supabase.rpc("set_current_org", { p_org_id: data });
    if (e2) {
      setError(e2.message || "Impossible de sélectionner l’organisation");
      setLoading(false);
      return;
    }

    window.dispatchEvent(new Event("fa:org_changed"));
    router.replace("/dashboard");
  }

  async function activatePersonalSpace() {
    setLoading(true);
    setError(null);

    // ✅ RPC atomique : create_personal_org() + set_current_org()
    const { data, error: e1 } = await supabase.rpc("onboarding_independent_start");

    if (e1 || !data) {
      setError(e1?.message || "Impossible d’activer l’espace personnel");
      setLoading(false);
      return;
    }

    window.dispatchEvent(new Event("fa:org_changed"));
    router.replace("/dashboard");
  }

  return (
    <BlueAuthShell title={title} subtitle={subtitle}>
      <div style={{ display: "grid", gap: 12 }}>
        {error && <div style={ui.error}>{error}</div>}

        {/* Choix du parcours */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>Je suis :</div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 850 }}>
            <input
              type="radio"
              name="mode"
              checked={mode === "business"}
              onChange={() => setMode("business")}
              disabled={loading}
            />
            <span>Organisme de formation</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 850 }}>
            <input
              type="radio"
              name="mode"
              checked={mode === "personal"}
              onChange={() => setMode("personal")}
              disabled={loading}
            />
            <span>Indépendant (espace personnel)</span>
          </label>
        </div>

        {/* Form business */}
        {mode === "business" && (
          <div style={ui.inputWrap}>
            <input
              style={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de l’organisme"
              disabled={loading}
            />

            <button
              style={ui.primaryBtn}
              onClick={() => void createBusinessOrg()}
              disabled={loading}
            >
              {loading ? "Création…" : "Créer mon organisme"}
            </button>
          </div>
        )}

        {/* Action personal */}
        {mode === "personal" && (
          <div style={ui.inputWrap}>
            <button
              style={ui.primaryBtn}
              onClick={() => void activatePersonalSpace()}
              disabled={loading}
            >
              {loading ? "Activation…" : "Activer mon espace personnel"}
            </button>

            <div style={{ fontSize: 13, opacity: 0.65, fontWeight: 800 }}>
              Vous pourrez ensuite créer / rejoindre un organisme depuis “Mes accès”.
            </div>
          </div>
        )}
      </div>
    </BlueAuthShell>
  );
}
