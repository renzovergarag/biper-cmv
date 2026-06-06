import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "VIPER CMV - Gestión de Eventos",
    description: "Sistema de despacho y gestión de eventos territoriales",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        title: "VIPER CMV",
        statusBarStyle: "black-translucent",
    },
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={`${inter.className} antialiased`}>
                <AuthProvider>
                    {children}
                    <Toaster />
                </AuthProvider>
            </body>
        </html>
    );
}
