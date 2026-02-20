"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, Eye, Pencil, Trash2 } from "lucide-react";

type Session = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  delivery_type: "direct" | "subcontract";
  client?: { name: string } | null;
  product?: { name: string } | null;
};

export default function SessionsList({
  sessions,
  onChanged,
}: {
  sessions: Session[];
  onChanged?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onDelete(sessionId: string) {
    const ok = window.confirm("Supprimer cette session ?");
    if (!ok) return;

    setDeletingId(sessionId);

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

    setDeletingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    onChanged?.();
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const open = openId === s.id;
        const isDeleting = deletingId === s.id;

        return (
          <div key={s.id} className="rounded-2xl border bg-white transition">
            <div className="flex w-full items-center justify-between gap-3 p-4">
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex flex-1 items-center justify-between text-left"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {s.product?.name ?? s.name}
                    </span>

                    {s.delivery_type === "subcontract" && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        Sous-traitance
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-slate-500">
                    {s.client?.name ?? "—"} • du {s.start_date} au {s.end_date}
                  </div>
                </div>

                <ChevronDown
                  className={`ml-3 h-5 w-5 shrink-0 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border p-2 hover:bg-slate-50"
                  title="Voir"
                  onClick={() => alert("Voir : étape suivante")}
                >
                  <Eye className="h-4 w-4" />
                </button>

                <button
                  className="rounded-xl border p-2 hover:bg-slate-50"
                  title="Modifier"
                  onClick={() => alert("Modifier : étape suivante")}
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  className="rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Supprimer"
                  onClick={() => onDelete(s.id)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {open && (
              <div className="border-t p-4 text-sm text-slate-500">
                Détails de la session (étape suivante)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
