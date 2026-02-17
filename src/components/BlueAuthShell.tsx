// src/components/BlueAuthShell.tsx  ✅ import corrigé

"use client";

import React from "react";
import { authUi as uiRaw } from "@/lib/ui";

const ui: any = uiRaw;

export function BlueAuthShell({
  title,
  subtitle,
  children,
  brandTop,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  brandTop?: React.ReactNode;
}) {
  return (
    <div style={ui.colors.bg}>
      <div style={ui.card}>
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          {brandTop ? <div style={{ marginBottom: 8 }}>{brandTop}</div> : null}
          <h1 style={ui.title}>{title}</h1>
          {subtitle ? <div style={ui.subtitle}>{subtitle}</div> : null}
        </div>

        <div style={{ marginTop: 18 }}>{children}</div>
      </div>
    </div>
  );
}
