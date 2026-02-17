import React from "react";
import { ui } from "@/lib/ui/tokens";

export function Card(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: ui.colors.bg,
        border: ui.border,
        borderRadius: ui.radius.xl,
        boxShadow: ui.shadow.md,
      }}
    >
      {props.children}
    </div>
  );
}

export function CardHeader(props: { children: React.ReactNode }) {
  return <div style={{ padding: 16, borderBottom: ui.border }}>{props.children}</div>;
}

export function CardBody(props: { children: React.ReactNode }) {
  return <div style={{ padding: 16 }}>{props.children}</div>;
}

export function CardFooter(props: { children: React.ReactNode }) {
  return <div style={{ padding: 16, borderTop: ui.border }}>{props.children}</div>;
}
