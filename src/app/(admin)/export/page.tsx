"use client";

import * as React from "react";
import ExcelJS from "exceljs";
import { supabase } from "@/lib/supabaseClient";

type RgpdPayload = Record<string, any>;

export default function ExportPage() {
  const [loading, setLoading] = React.useState<
    "json" | "xlsx" | "full-xlsx" | "full-csv" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = React.useState<string>("");

  React.useEffect(() => {
    async function checkSession() {
      if (!supabase) {
        setSessionInfo("session NULL (client supabase introuvable)");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setSessionInfo(`session error: ${error.message}`);
        return;
      }

      const s = data.session;
      setSessionInfo(
        s?.user
          ? `session OK: ${s.user.email ?? s.user.id}`
          : "session NULL (pas connecté supabase)"
      );
    }

    void checkSession();
  }, []);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function fetchRgpd(): Promise<RgpdPayload> {
    if (!supabase) {
      throw new Error("Client Supabase introuvable");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error("Session Supabase absente (reconnecte-toi)");
    }

    const { data, error } = await supabase.rpc("get_my_rgpd_export");
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object") {
      throw new Error("RGPD payload vide ou invalide");
    }

    return data as RgpdPayload;
  }

  async function exportJson() {
    try {
      setError(null);
      setLoading("json");

      const payload = await fetchRgpd();
      const stamp = new Date().toISOString().slice(0, 10);

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      downloadBlob(blob, `rgpd-export-${stamp}.json`);
    } catch (e: any) {
      setError(e?.message || "Erreur export RGPD");
    } finally {
      setLoading(null);
    }
  }

  async function exportXlsx() {
    try {
      setError(null);
      setLoading("xlsx");

      const payload = await fetchRgpd();
      const stamp = new Date().toISOString().slice(0, 10);
      const wb = new ExcelJS.Workbook();

      const ws = wb.addWorksheet("RGPD");
      ws.addRow(["key", "value"]).font = { bold: true };

      for (const [k, v] of Object.entries(payload)) {
        ws.addRow([k, typeof v === "string" ? v : JSON.stringify(v)]);
      }

      for (const [k, v] of Object.entries(payload)) {
        if (Array.isArray(v) && v.length && typeof v[0] === "object") {
          const sheet = wb.addWorksheet(k.slice(0, 31));
          const headers = Array.from(
            v.reduce((set: Set<string>, row: any) => {
              Object.keys(row || {}).forEach((x) => set.add(x));
              return set;
            }, new Set<string>())
          );
          sheet.addRow(headers).font = { bold: true };
          v.forEach((row: any) =>
            sheet.addRow(headers.map((h) => row?.[h] ?? ""))
          );
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadBlob(blob, `rgpd-export-${stamp}.xlsx`);
    } catch (e: any) {
      setError(e?.message || "Erreur export RGPD");
    } finally {
      setLoading(null);
    }
  }

  async function exportFull(format: "xlsx" | "csv") {
    try {
      setError(null);
      setLoading(format === "xlsx" ? "full-xlsx" : "full-csv");

      if (!supabase) {
        throw new Error("Client Supabase introuvable");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session Supabase absente (reconnecte-toi)");

      const res = await fetch(`/api/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let message = "Erreur export complet";
        try {
          const j = await res.json();
          message = j?.error ?? message;
        } catch {}
        throw new Error(message);
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const blob = await res.blob();

      downloadBlob(
        blob,
        format === "xlsx"
          ? `export-complet-${stamp}.xlsx`
          : `export-complet-${stamp}-csv.zip`
      );
    } catch (e: any) {
      setError(e?.message || "Erreur export complet");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Exports des données</h1>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
        {sessionInfo}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontWeight: 700 }}>Export RGPD</h2>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button disabled={!!loading} onClick={() => void exportJson()}>
            {loading === "json" ? "Export JSON…" : "RGPD JSON"}
          </button>

          <button disabled={!!loading} onClick={() => void exportXlsx()}>
            {loading === "xlsx" ? "Export Excel…" : "RGPD Excel"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontWeight: 700 }}>Export complet (hors RGPD)</h2>
        <p style={{ fontSize: 12, opacity: 0.75 }}>
          Clients, apprenants, sessions, dépenses, factures/devis, produits…
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button disabled={!!loading} onClick={() => void exportFull("xlsx")}>
            {loading === "full-xlsx" ? "Export Excel…" : "Export Excel"}
          </button>

          <button disabled={!!loading} onClick={() => void exportFull("csv")}>
            {loading === "full-csv" ? "Export CSV…" : "Export CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}