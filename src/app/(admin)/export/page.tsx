"use client";

import * as React from "react";

export default function ExportPage() {
  const [loading, setLoading] = React.useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function download(format: "csv" | "xlsx") {
    try {
      setError(null);
      setLoading(format);

      const res = await fetch(`/api/export?format=${format}`, { method: "GET" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="(.+?)"/);
      const filename =
        match?.[1] || (format === "xlsx" ? "export.xlsx" : "export_csv.zip");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Erreur export");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Exporter mes données</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Export complet (limité à tes organisations).
      </p>

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

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => download("csv")}
          disabled={!!loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading === "csv" ? "Export CSV…" : "Exporter en CSV (zip)"}
        </button>

        <button
          onClick={() => download("xlsx")}
          disabled={!!loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading === "xlsx" ? "Export Excel…" : "Exporter en Excel (.xlsx)"}
        </button>
      </div>
    </div>
  );
}