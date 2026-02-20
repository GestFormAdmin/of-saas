import * as React from "react";

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
  children: React.ReactNode;
  brandTop?: React.ReactNode;
};

export default function BlueAuthShell({
  title,
  subtitle,
  description,
  children,
  brandTop,
}: Props) {
  const text = subtitle ?? description;

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        {brandTop}
        <h1 className="text-xl font-semibold">{title}</h1>
        {text ? <p className="mt-1 text-sm text-muted-foreground">{text}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
