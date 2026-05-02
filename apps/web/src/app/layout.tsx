import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIPER CMV - Gestión de Eventos",
  description: "Sistema de despacho y gestión de eventos territoriales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
