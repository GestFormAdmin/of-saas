import React from "react";
import { ui } from "@/lib/ui/tokens";

export function StatCard(props: { title: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div
      style={{
        background: ui.colors.bg,
        border: ui.border,
        borderRadius: ui.radius.xl,
        boxShadow: ui.shadow.md,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: ui.colors.muted, fontWeight: 700 }}>{props.title}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: ui.colors.text }}>{props.value}</div>
      {props.hint ? <div style={{ marginTop: 6, fontSize: 12, color: ui.colors.muted }}>{props.hint}</div> : null}
    </div>
  );
}
