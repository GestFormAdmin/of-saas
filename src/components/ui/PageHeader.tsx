import React from "react";
import { ui } from "@/lib/ui/tokens";

export function PageHeader(props: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        borderBottom: ui.borderSoft,
        paddingBottom: 12,
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: ui.colors.text }}>
          {props.title}
        </div>

        {props.subtitle ? (
          <div style={{ marginTop: 6, color: ui.colors.muted, fontSize: 14 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
