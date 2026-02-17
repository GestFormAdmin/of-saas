"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  type: "initial" | "recyclage";
  duration_hours: number | null;
  price_intra: number | null;
  price_inter: number | null;
  learners_total: number;
  learners_year: number;
  success_rate: number | null;
  objective: string | null;
  competencies: string[];
  certificate_name: string | null;
  created_at: string;
};

export default function ProduitsPage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  const eur = useMemo(
    () => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }),
    []
  );
  const formatEUR = (v: number | null) => (v == null ? "—" : eur.format(v));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // modal mode: "create" | "view" | "edit"
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "view" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  // form
  const [name, setName] = useState("");
  const [type, setType] = useState<"initial" | "recyclage">("initial");
  const [durationHours, setDurationHours] = useState("");
  const [priceIntra, setPriceIntra] = useState("");
  const [priceInter, setPriceInter] = useState("");
  const [successRate, setSuccessRate] = useState("");
  const [objective, setObjective] = useState("");
  const [certificateName, setCertificateName] = useState("");

  const [competencies, setCompetencies] = useState<string[]>([]);
  const [competencyInput, setCompetencyInput] = useState("");

  function resetForm() {
    setName("");
    setType("initial");
    setDurationHours("");
    setPriceIntra("");
    setPriceInter("");
    setSuccessRate("");
    setObjective("");
    setCertificateName("");
    setCompetencies([]);
    setCompetencyInput("");
  }

  function fillFormFromProduct(p: Product) {
    setName(p.name ?? "");
    setType(p.type ?? "initial");
    setDurationHours(p.duration_hours == null ? "" : String(p.duration_hours));
    setPriceIntra(p.price_intra == null ? "" : String(p.price_intra));
    setPriceInter(p.price_inter == null ? "" : String(p.price_inter));
    setSuccessRate(p.success_rate == null ? "" : String(p.success_rate));
    setObjective(p.objective ?? "");
    setCertificateName(p.certificate_name ?? "");
    setCompetencies(Array.isArray(p.competencies) ? p.competencies : []);
    setCompetencyInput("");
  }

  async function loadProducts() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function addCompetency() {
    const v = competencyInput.trim();
    if (!v) return;
    if (competencies.includes(v)) return setCompetencyInput("");
    setCompetencies([...competencies, v]);
    setCompetencyInput("");
  }

  function removeCompetency(v: string) {
    setCompetencies(competencies.filter((c) => c !== v));
  }

  function openCreate() {
    setMode("create");
    setSelected(null);
    resetForm();
    setOpen(true);
  }

  function openView(p: Product) {
    setMode("view");
    setSelected(p);
    fillFormFromProduct(p);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setMode("edit");
    setSelected(p);
    fillFormFromProduct(p);
    setOpen(true);
  }

  async function createProduct() {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("products").insert({
      name: name.trim(),
      type,
      duration_hours: durationHours ? Number(durationHours) : null,
      price_intra: priceIntra ? Number(priceIntra) : null,
      price_inter: priceInter ? Number(priceInter) : null,
      success_rate: successRate ? Number(successRate) : null,
      objective: objective || null,
      competencies,
      certificate_name: certificateName || null,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    resetForm();
    await loadProducts();
  }

  async function updateProduct() {
    if (!selected) return;
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("products")
      .update({
        name: name.trim(),
        type,
        duration_hours: durationHours ? Number(durationHours) : null,
        price_intra: priceIntra ? Number(priceIntra) : null,
        price_inter: priceInter ? Number(priceInter) : null,
        success_rate: successRate ? Number(successRate) : null,
        objective: objective || null,
        competencies,
        certificate_name: certificateName || null,
      })
      .eq("id", selected.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    setSelected(null);
    resetForm();
    await loadProducts();
  }

  async function deleteProduct(p: Product) {
    const ok = confirm(`Supprimer "${p.name}" ?`);
    if (!ok) return;

    setError(null);

    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      setError(error.message);
      return;
    }

    // si la modal est ouverte sur ce produit, on ferme
    if (selected?.id === p.id) {
      setOpen(false);
      setSelected(null);
    }

    await loadProducts();
  }

  const readOnly = mode === "view";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produits & services</h1>
          <p className="mt-1 text-sm text-gray-500">Année en cours : {year}</p>
        </div>

        <button
          className="rounded-xl border px-5 py-3 text-sm font-medium hover:bg-gray-50"
          onClick={openCreate}
        >
          + Nouveau produit
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border p-3 text-sm">Erreur : {error}</div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-6 py-4">Nom</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Durée</th>
              <th className="px-6 py-4">Prix intra</th>
              <th className="px-6 py-4">Prix inter</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Année</th>
              <th className="px-6 py-4">Réussite</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-6 text-center text-gray-500">
                  Chargement…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-6 text-center text-gray-500">
                  Aucun produit
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-6 py-4 font-medium">{p.name}</td>
                  <td className="px-6 py-4">{p.type}</td>
                  <td className="px-6 py-4">
                    {p.duration_hours ?? "—"}
                    {p.duration_hours ? "h" : ""}
                  </td>
                  <td className="px-6 py-4">{formatEUR(p.price_intra)}</td>
                  <td className="px-6 py-4">{formatEUR(p.price_inter)}</td>
                  <td className="px-6 py-4">{p.learners_total ?? 0}</td>
                  <td className="px-6 py-4">{p.learners_year ?? 0}</td>
                  <td className="px-6 py-4">
                    {p.success_rate == null ? "—" : p.success_rate}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-md border p-2 hover:bg-gray-50"
                        title="Voir"
                        onClick={() => openView(p)}
                      >
                        👁️
                      </button>

                      <button
                        type="button"
                        className="rounded-md border p-2 hover:bg-gray-50"
                        title="Modifier"
                        onClick={() => openEdit(p)}
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        className="rounded-md border p-2 text-red-600 hover:bg-gray-50"
                        title="Supprimer"
                        onClick={() => deleteProduct(p)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-base font-semibold">
                {mode === "create"
                  ? "Nouveau produit"
                  : mode === "view"
                  ? "Voir produit"
                  : "Modifier produit"}
              </h2>
              <button
                type="button"
                className="text-sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Nom</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "initial" | "recyclage")
                  }
                  disabled={readOnly}
                >
                  <option value="initial">initial</option>
                  <option value="recyclage">recyclage</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Durée (heures)</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  inputMode="numeric"
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prix intra (groupe)</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={priceIntra}
                  onChange={(e) => setPriceIntra(e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prix inter (1 pers)</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={priceInter}
                  onChange={(e) => setPriceInter(e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Taux de réussite</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={successRate}
                  onChange={(e) => setSuccessRate(e.target.value)}
                  inputMode="decimal"
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nom du certificat</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={certificateName}
                  onChange={(e) => setCertificateName(e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Objectif (masqué)</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  disabled={readOnly}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Compétences (masqué)</label>

                {!readOnly && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={competencyInput}
                      onChange={(e) => setCompetencyInput(e.target.value)}
                      placeholder="Ex: Réaliser une consignation"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCompetency();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={addCompetency}
                    >
                      Ajouter
                    </button>
                  </div>
                )}

                {competencies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {competencies.map((c, idx) => (
                      <button
                        key={c}
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                        onClick={() => {
                          if (!readOnly) removeCompetency(c);
                        }}
                        title={readOnly ? "" : "Cliquer pour supprimer"}
                        disabled={readOnly}
                      >
                        {idx + 1}- {c} {readOnly ? "" : "✕"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Fermer
              </button>

              {mode === "create" && (
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  onClick={createProduct}
                  disabled={saving || !name.trim()}
                >
                  {saving ? "Création…" : "Créer"}
                </button>
              )}

              {mode === "edit" && (
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  onClick={updateProduct}
                  disabled={saving || !name.trim()}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              )}

              {mode === "view" && selected && (
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => openEdit(selected)}
                >
                  Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
