import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";
import { AppLayoutClient } from "@/components/AppLayoutClient";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        <AppLayoutClient>
          {children}
        </AppLayoutClient>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
