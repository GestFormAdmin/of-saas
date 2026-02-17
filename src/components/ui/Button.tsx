"use client";

import React from "react";
import { ui } from "@/lib/ui/tokens";

type Variant = "primary" | "soft" | "danger";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "soft",
  size = "md",
  style,
  disabled,
  ...props
}: Props) {
  const base: React.CSSProperties = {
    height: size === "sm" ? 36 : 40,
    padding: size === "sm" ? "0 12px" : "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "#fff",
    color: "rgb(15, 23, 42)",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };

  const variants: Record<Variant, React.CSSProperties> = {
    soft: {
      background: "#fff",
      border: "1px solid rgba(15, 23, 42, 0.12)",
      color: "rgb(15, 23, 42)",
    },
    primary: {
      background: "rgb(220, 38, 38)",
      border: "1px solid rgba(220, 38, 38, 0.35)",
      color: "#fff",
      boxShadow: "0 10px 24px rgba(220,38,38,.20)",
    },
    danger: {
      background: "#fff",
      border: "1px solid rgba(220, 38, 38, 0.30)",
      color: "rgb(220, 38, 38)",
    },
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    />
  );
}
