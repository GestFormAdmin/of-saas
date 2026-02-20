"use client";

import React from "react";

export function EmptyState(props: { title?: string; description?: string }) {
  const { title = "Aucun élément", description } = props;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: "rgba(15, 23, 42, 0.02)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 950, opacity: 0.85 }}>{title}</div>
      {description ? <div style={{ marginTop: 6, opacity: 0.65, fontWeight: 800 }}>{description}</div> : null}
    </div>
  );
}
