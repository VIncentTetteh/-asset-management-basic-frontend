import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AppLayoutClient } from "@/components/AppLayoutClient";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChunkRecoveryListener } from "@/components/errors/ChunkRecoveryListener";

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
      <body>
        {/*
          Recovers a tab left open across a deploy: a route chunk that 404s on
          navigation rejects outside React, so no error boundary ever sees it.
          Must sit outside AuthProvider — it has to work even if the app shell
          is the thing that failed to load.
        */}
        <ChunkRecoveryListener />
        {/* AuthProvider wraps the entire app — provides useAuth() and <Can> everywhere */}
        <AuthProvider>
          <AppLayoutClient>
            {children}
          </AppLayoutClient>
          {/*
            Toasts are acknowledgements only — see src/lib/notify.ts for when a
            toast is the wrong channel. `ea-toast` exists so globals.css can
            drop react-hot-toast's slide-in under prefers-reduced-motion, and
            the aria defaults make an announcement polite unless a caller
            (notify.error) upgrades it to assertive.
          */}
          <Toaster
            position="top-right"
            toastOptions={{
              className: "ea-toast",
              ariaProps: { role: "status", "aria-live": "polite" },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
