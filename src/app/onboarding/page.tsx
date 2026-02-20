"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrgId } from "@/lib/getCurrentOrgId";

type ClientRow = {
  id: string;
  name: string | null;
  city: string | null;
};

export default function ClientsPage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // modal create
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  async function ensureOrgId(): Promise<string> {
    const oid = orgId ?? (await getCurrentOrgId());
    if (!oid) throw new Error("org_id introuvable");
    if (!orgId) setOrgId(oid);
    return oid;
  }

  async function loadClients() {
    setLoading(true);
    setError(null);

    try {
      const oid = await ensureOrgId();

      const { data, error } = await supabase
        .from("clients")
        .select("id,name,city")
        .eq("org_id", oid)
        .order("name");

      if (error) throw error;

      setClients((data ?? []) as ClientRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClient() {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const oid = await ensureOrgId();

      const { error } = await supabase.from("clients").insert({
        org_id: oid,
        name: name.trim(),
        city: city.trim() || null,
      });

      if (error) throw error;

      setName("");
      setCity("");
      setOpenCreate(false);
      await loadClients();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">Année en cours : {year}</p>
        </div>

        <button
          type="button"
          className="rounded-xl border px-5 py-3 text-sm font-medium hover:bg-gray-50"
          onClick={() => setOpenCreate(true)}
        >
          + Nouveau client
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border p-3 text-sm">
          <span className="font-medium">Erreur :</span>{" "}
          <span className="text-gray-700">{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-6 py-4">Nom</th>
              <th className="px-6 py-4">Ville</th>
              <th className="px-6 py-4">Total apprenants</th>
              <th className="px-6 py-4">Apprenants {year}</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                  Chargement…
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                  Aucun client
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{c.name ?? "—"}</td>
                  <td className="px-6 py-4">{c.city ?? "—"}</td>
                  <td className="px-6 py-4">0</td>
                  <td className="px-6 py-4">0</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenCreate(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-base font-semibold">Créer un client</h2>
              <button
                type="button"
                className="text-sm"
                onClick={() => setOpenCreate(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <label className="text-sm font-medium">Nom</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: SNCF"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ville</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Paris"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setOpenCreate(false)}
                disabled={saving}
              >
                Annuler
              </button>

              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={createClient}
                disabled={saving || !name.trim()}
              >
                {saving ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
