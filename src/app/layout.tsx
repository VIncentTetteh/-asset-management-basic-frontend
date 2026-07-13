import type { Metadata } from "next";
import { Manrope, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AppLayoutClient } from "@/components/AppLayoutClient";
import { AuthProvider } from "@/contexts/AuthContext";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["600", "700", "800"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AssetIQ — Enterprise Asset Management",
  description: "AssetIQ is the enterprise asset management platform for tracking, depreciation, maintenance, and compliance across your entire organisation.",
};

/**
 * Applies the persisted theme before first paint so a dark-mode user never
 * sees a light flash. Kept as an inline script (not a component effect)
 * deliberately — effects run after hydration, which is too late.
 */
const themeBootScript = `
try {
  var t = localStorage.getItem("assetiq-theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${manrope.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        {/* AuthProvider wraps the entire app — provides useAuth() and <Can> everywhere */}
        <AuthProvider>
          <AppLayoutClient>
            {children}
          </AppLayoutClient>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
