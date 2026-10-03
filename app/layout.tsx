import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "McD Macro",
  description: "Personal nutrition planning tool. Not affiliated with McDonald's.",
  manifest: "/manifest.json",
  authors: [{ name: "Mohammad Almansoori" }],
  creator: "Mohammad Almansoori",
  appleWebApp: {
    capable: true,
    title: "McD Macro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0405",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">
        <div className="ambient" aria-hidden />
        <div className="relative z-10" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
          <LanguageProvider>
            {children}
            <Suspense>
              <BottomNav />
            </Suspense>
          </LanguageProvider>
        </div>
      </body>
    </html>
  );
}
