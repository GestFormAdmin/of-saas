"use client";

import React, { useEffect, useState } from "react";
import RequirePageAccessClient from "@/features/auth/RequirePageAccessClient";
import { supabase } from "@/lib/supabaseClient";

type DocTpl = {
  id: string;
  doc_type: string | null;
  name: string | null;
  file_path: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function frDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR");
}

export default function DocumentsViergesPage() {
  const [rows, setRows] = useState<DocTpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [docType, setDocType] = useState("attestation_formation");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ================= LOAD LIST =================
  const load = async () => {
    setLoading(true);
    setErr(null);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;

    if (!token) {
      setErr("Session expirée, reconnecte-toi.");
      setRows([]);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/document-templates", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(j?.error ?? "Erreur chargement");
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(j.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // ================= UPLOAD =================
  const upload = async () => {
    if (!file) return alert("Choisis un fichier .docx");
    if (!docType.trim()) return alert("Type requis");

    setUploading(true);
    setErr(null);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;

    if (!token) {
      setUploading(false);
      alert("Session expirée, reconnecte-toi.");
      return;
    }

    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);

    const res = await fetch("/api/admin/document-templates/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const j = await res.json().catch(() => ({}));
    setUploading(false);

    if (!res.ok) {
      setErr(j?.error ?? "Erreur import");
      return;
    }

    setFile(null);
    const inp = document.getElementById("fileInput") as HTMLInputElement | null;
    if (inp) inp.value = "";

    await load();
  };

  // ================= VIEW =================
  const view = async (id: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return alert("Session expirée, reconnecte-toi.");

    const res = await fetch("/api/admin/document-templates/signed-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error ?? "Erreur visualisation");

    window.open(j.url, "_blank");
  };

  // ================= DELETE =================
  const del = async (id: string) => {
    const ok = window.confirm("Supprimer ce document ?");
    if (!ok) return;

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return alert("Session expirée, reconnecte-toi.");

    const res = await fetch("/api/admin/document-templates/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j?.error ?? "Erreur suppression");

    await load();
  };

  return (
    <RequirePageAccessClient pageKey="documents_vierges" fallback={null}>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Documents vierges</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              Templates Word utilisés pour générer les documents.
            </div>
          </div>

          <button
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-muted/20"
            onClick={() => void load()}
          >
            Rafraîchir
          </button>
        </div>

        {/* IMPORT */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="mb-3 text-sm font-bold">Importer un document</div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Type</div>
              <select
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="attestation_formation">attestation_formation</option>
                <option value="devis">devis</option>
                <option value="facture">facture</option>
                <option value="convention">convention</option>
              </select>
            </div>

            <div className="col-span-6">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Fichier .docx</div>
              <input
                id="fileInput"
                type="file"
                accept=".docx"
                className="w-full rounded-xl border px-4 py-3 text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="col-span-2 flex items-end">
              <button
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={uploading || !file}
                onClick={() => void upload()}
              >
                {uploading ? "Import…" : "Importer"}
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
              {err}
            </div>
          )}
        </div>

        {/* LISTE */}
        <div className="rounded-2xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-bold">Liste</div>

          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Aucun document</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Nom
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Créé
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3 font-semibold">{r.doc_type ?? "—"}</td>
                      <td className="px-4 py-3">{r.name ?? r.file_path ?? "—"}</td>
                      <td className="px-4 py-3">{frDateTime(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-muted/20"
                            onClick={() => void view(r.id)}
                          >
                            Visualiser
                          </button>
                          <button
                            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-muted/20"
                            onClick={() => void del(r.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RequirePageAccessClient>
  );
}