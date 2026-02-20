import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OF-FormaAdmin",
  description: "Back-office pour organismes de formation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
