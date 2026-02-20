// src/lib/ui/tokens.ts
export const ui = {
  radius: { sm: 10, md: 12, lg: 14, xl: 18, xxl: 24 },
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderSoft: "1px solid rgba(15, 23, 42, 0.10)",
  shadow: {
    sm: "0 1px 0 rgba(15, 23, 42, 0.04)",
    md: "0 10px 24px rgba(2, 6, 23, 0.10)",
  },
  colors: {
    text: "rgb(15, 23, 42)",
    muted: "rgba(15, 23, 42, 0.65)",
    bg: "#ffffff",
    primary: "rgb(220, 38, 38)",
    primaryBorder: "rgba(220, 38, 38, 0.35)",
    danger: "rgb(220, 38, 38)",
    dangerBorder: "rgba(220, 38, 38, 0.30)",
    softBg: "rgba(15, 23, 42, 0.04)",
    softBorder: "rgba(15, 23, 42, 0.10)",
  },
} as const;
