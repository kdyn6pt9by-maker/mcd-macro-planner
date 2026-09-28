import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "McD Macro",
  description: "Personal nutrition planning tool. Not affiliated with McDonald's.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0d0505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-[#f5e9ea] antialiased">{children}</body>
    </html>
  );
}
