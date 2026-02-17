// src/lib/ui.ts  ✅ remplace TOUT le fichier par celui-ci (export authUi)

import type { CSSProperties } from "react";

export const authUi = {
  toast: {
    success: (_msg: string) => {},
    error: (_msg: string) => {},
    info: (_msg: string) => {},
  },

  bg: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    fontFamily: "system-ui",
    background:
      "radial-gradient(1200px 800px at 30% 10%, #1d3aa8 0%, #0b1b58 55%, #07133f 100%)",
  } as CSSProperties,

  card: {
    width: "min(860px, 92vw)",
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
    border: "1px solid rgba(255,255,255,0.25)",
    padding: 36,
  } as CSSProperties,

  title: {
    margin: 0,
    marginTop: 8,
    fontSize: 40,
    letterSpacing: "-0.6px",
    color: "#0d1535",
    textAlign: "center",
  } as CSSProperties,

  subtitle: {
    marginTop: 10,
    fontSize: 22,
    color: "rgba(13,21,53,0.55)",
    textAlign: "center",
    lineHeight: 1.35,
  } as CSSProperties,

  inputWrap: {
    marginTop: 22,
    display: "grid",
    gap: 12,
    justifyItems: "center",
  } as CSSProperties,

  input: {
    width: "min(640px, 90%)",
    padding: "18px 18px",
    borderRadius: 14,
    border: "3px solid #2a57ff",
    outline: "none",
    fontSize: 18,
  } as CSSProperties,

  primaryBtn: {
    width: "min(640px, 90%)",
    marginTop: 18,
    padding: "18px 18px",
    borderRadius: 14,
    border: "none",
    background: "#f1a0a6",
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
  } as CSSProperties,

  mutedLink: {
    marginTop: 14,
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    cursor: "pointer",
    textDecoration: "underline",
  } as CSSProperties,

  helper: {
    marginTop: 14,
    fontSize: 14,
    color: "rgba(13,21,53,0.55)",
    textAlign: "center",
  } as CSSProperties,

  error: {
    marginTop: 14,
    color: "#b00020",
    fontSize: 14,
    textAlign: "center",
  } as CSSProperties,
} as const;
