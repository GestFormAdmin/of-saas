"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSavedAndOpenClients?: () => void; // optionnel
};

export default function CreateClientModal({ open, onClose, onSaved, onSavedAndOpenClients }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setName("");
    setCity("");
    setEmail("");
    setPhone("");
    setStreet("");
    setZipCode("");
  }, [open]);

  async function save(mode: "stay" | "openClients" = "stay") {
    if (!name.trim()) {
      setErr("Nom obligatoire");
      return;
    }

    setSaving(true);
    setErr(null);

    const payload = {
      name: name.trim(),
      address_city: city.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address_street: street.trim() || null,
      address_postal_code: zipCode.trim() || null,
    };

    const { error } = await supabase.from("clients").insert(payload);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);

    onSaved(); // refresh liste
    onClose(); // ferme la modale

    if (mode === "openClients") {
      onSavedAndOpenClients?.();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un client">
      <div className="space-y-3">
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
        )}

        <div>
          <label className="text-xs text-gray-600">Nom *</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du client"
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Ville</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Paris"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-gray-600">Email</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domaine.com"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Téléphone</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06..."
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600">Rue</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Adresse"
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Code postal</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="75000"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="soft" onClick={onClose} disabled={saving}>
          Annuler
        </Button>

        <Button variant="soft" onClick={() => void save("stay")} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>

        <Button variant="primary" onClick={() => void save("openClients")} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer + ouvrir Clients"}
        </Button>
      </div>
    </Modal>
  );
}
