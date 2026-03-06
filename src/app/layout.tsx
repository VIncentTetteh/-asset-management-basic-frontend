import type { Metadata } from "next";
import { Manrope, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AppLayoutClient } from "@/components/AppLayoutClient";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Enterprise Asset Management",
  description: "Enterprise multi-tenancy asset management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Simple check for auth routes to not show sidebar
  // (In a real app, middleware or a separate layout group for (auth) would be better)

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${ibmPlexSans.variable}`}>
        <AppLayoutClient>
          {children}
        </AppLayoutClient>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
