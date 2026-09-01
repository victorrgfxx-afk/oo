import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audit gratuit de profil social media",
  description:
    "Iti analizam profilul de social media si iti trimitem pe mail, in 48 de ore, un audit cu ce sa schimbi, copy gata de folosit si 12 idei de continut pentru nisa ta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
