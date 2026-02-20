"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/browser";

export default function ProfileLogoUploader(props: {
  initialUrl?: string | null;
  onSaved?: (url: string) => void;
}) {
  const [preview, setPreview] = React.useState<string | null>(props.initialUrl ?? null);
  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPreview(props.initialUrl ?? null);
  }, [props.initialUrl]);

  const pick = async (file: File) => {
    setErrorMsg(null);

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Fichier invalide");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image trop lourde (max 5MB)");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setErrorMsg("Non connecté");
        return;
      }

      const ext = (file.name.split(".").pop() || "png")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const safeExt = ext || "png";
      const path = `users/${uid}/logo.${safeExt}`;

      const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || "image/png",
      });

      if (uploadErr) {
        setErrorMsg(uploadErr.message);
        return;
      }

      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: rpcErr } = await supabase.rpc("update_my_profile_logo_url", {
        p_logo_url: publicUrl,
      });

      if (rpcErr) {
        setErrorMsg(rpcErr.message);
        return;
      }

      setPreview(publicUrl);
      props.onSaved?.(publicUrl);
    } finally {
      setBusy(false);
      try {
        URL.revokeObjectURL(localPreview);
      } catch {}
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            overflow: "hidden",
            background: "rgba(0,0,0,0.06)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 12, opacity: 0.6 }}>Logo</span>
          )}
        </div>

        <label
          style={{
            display: "inline-flex",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
            userSelect: "none",
          }}
        >
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void pick(f);
              e.currentTarget.value = "";
            }}
          />
          {busy ? "Upload..." : "Ajouter / Modifier"}
        </label>
      </div>

      {errorMsg && <div style={{ fontSize: 12, color: "#b00020" }}>{errorMsg}</div>}
    </div>
  );
}
