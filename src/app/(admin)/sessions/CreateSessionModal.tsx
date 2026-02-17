"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DeliveryType = "direct" | "subcontract";

type ClientRow = { id: string; name: string };
type ProductRow = { id: string; name: string; nb_hours?: number | null };

type CreatedSessionPayload = {
  id: string;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  product_id: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (s: CreatedSessionPayload) => void;
};

const CLIENTS_TABLE = "clients";
const PRODUCTS_TABLE = "products";
const SESSIONS_TABLE = "sessions";

const required = (v?: string | null) => !!v && v.trim().length > 0;

function isoOrNull(v: string) {
  const t = v?.trim();
  return t ? t : null;
}

function validate(form: {
  product_id: string;
  name: string;
  start_date: string;
  end_date: string;
}) {
  if (!required(form.product_id)) return "Merci de choisir une formation.";
  if (!required(form.name)) return "Nom de session requis.";
  if (!required(form.start_date) || !required(form.end_date)) return "Dates (du / au) requises.";

  const s = new Date(form.start_date);
  const e = new Date(form.end_date);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Dates invalides.";
  if (e < s) return "La date de fin doit être après la date de début.";

  return null;
}

export default function CreateSessionModal(props: Props) {
  const { open, onClose, onCreated } = props;

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    product_id: "",
    name: "",
    delivery_type: "direct" as DeliveryType,
    client_id: "",
    start_date: "",
    end_date: "",
    certification_date: "",
    location_structure: "",
    location_street: "",
    location_postal_code: "",
    location_city: "",
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function reset() {
    setError(null);
    setSaving(false);
    setForm({
      product_id: "",
      name: "",
      delivery_type: "direct",
      client_id: "",
      start_date: "",
      end_date: "",
      certification_date: "",
      location_structure: "",
      location_street: "",
      location_postal_code: "",
      location_city: "",
    });
  }

  // Reset quand on ouvre
  useEffect(() => {
    if (!open) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Charger clients + produits quand on ouvre
  useEffect(() => {
    if (!open) return;

    let canceled = false;

    async function loadRefs() {
      setLoadingRefs(true);
      setError(null);

      try {
        const [{ data: cData, error: cErr }, { data: pData, error: pErr }] = await Promise.all([
          supabase.from(CLIENTS_TABLE).select("id,name").order("name", { ascending: true }),
          supabase.from(PRODUCTS_TABLE).select("*").order("name", { ascending: true }),
        ]);

        if (canceled) return;

        if (cErr) throw cErr;
        if (pErr) throw pErr;

        setClients((cData ?? []) as ClientRow[]);

        const mapped = (pData ?? []).map((p: any) => ({
          id: p.id,
          name: p.name ?? p.label ?? p.title ?? "—",
          nb_hours: p.nb_hours ?? p.duration_hours ?? p.hours ?? null,
        })) as ProductRow[];

        setProducts(mapped);
      } catch (e: any) {
        if (canceled) return;
        setError(e?.message ?? "Erreur chargement des listes.");
        setClients([]);
        setProducts([]);
      } finally {
        if (!canceled) setLoadingRefs(false);
      }
    }

    loadRefs();

    return () => {
      canceled = true;
    };
  }, [open]);

  async function save() {
    if (saving) return;

    setError(null);
    const err = validate({
      product_id: form.product_id,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
    });
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);

    try {
      const org = await supabase.rpc("current_org_id");
      const orgId = org.data as string | null;

      if (org.error || !orgId) {
        setError(org.error?.message ?? "Organisation introuvable.");
        setSaving(false);
        return;
      }

      const payload = {
        org_id: orgId,
        product_id: form.product_id || null,
        client_id: form.client_id || null,
        name: form.name.trim(),
        delivery_type: form.delivery_type,
        start_date: form.start_date,
        end_date: form.end_date,
        certification_date: isoOrNull(form.certification_date),
        location_structure: form.location_structure.trim() || null,
        location_street: form.location_street.trim() || null,
        location_postal_code: form.location_postal_code.trim() || null,
        location_city: form.location_city.trim() || null,
      };

      // IMPORTANT: on récupère la row créée pour la renvoyer au parent
      const { data, error: insErr } = await supabase
        .from(SESSIONS_TABLE)
        .insert(payload)
        .select("id,name,start_date,end_date,client_id,product_id")
        .single();

      if (insErr) {
        setError(insErr.message);
        setSaving(false);
        return;
      }

      const created = data as CreatedSessionPayload;

      onClose();
      onCreated?.(created);
    } catch (e: any) {
      setError(e?.message ?? "Erreur création session.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!required(form.product_id)) return false;
    if (!required(form.name)) return false;
    if (!required(form.start_date) || !required(form.end_date)) return false;
    return true;
  }, [form, saving]);

  // ESC ferme
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">Créer une session</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Renseigne la formation, les dates et le type.
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Fermer
          </button>
        </div>

        {/* Error */}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Formation *</div>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={form.product_id}
                onChange={(e) => setField("product_id", e.target.value)}
                disabled={loadingRefs}
              >
                <option value="" disabled>
                  {loadingRefs ? "Chargement…" : "Sélectionner…"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-sm text-muted-foreground">Nom de session *</div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ex: Session Janvier"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Client (optionnel)</div>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={form.client_id}
                onChange={(e) => setField("client_id", e.target.value)}
                disabled={loadingRefs}
              >
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-sm text-muted-foreground">Type *</div>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={form.delivery_type}
                onChange={(e) => setField("delivery_type", e.target.value as DeliveryType)}
              >
                <option value="direct">Client direct</option>
                <option value="subcontract">Sous-traitance</option>
                <option value="sous_traitee">Sous-traitée</option>

              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Du *</div>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm text-muted-foreground">Au *</div>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2"
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm text-muted-foreground">Date certification (optionnel)</div>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
              value={form.certification_date}
              onChange={(e) => setField("certification_date", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Structure</div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.location_structure}
                onChange={(e) => setField("location_structure", e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm text-muted-foreground">Rue</div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.location_street}
                onChange={(e) => setField("location_street", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Code postal</div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.location_postal_code}
                onChange={(e) => setField("location_postal_code", e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 text-sm text-muted-foreground">Ville</div>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={form.location_city}
                onChange={(e) => setField("location_city", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2"
            disabled={saving}
          >
            Annuler
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-black px-4 py-2 text-white"
            disabled={!canSave}
          >
            {saving ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
