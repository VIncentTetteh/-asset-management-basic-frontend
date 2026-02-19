import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Asset Management System",
  description: "Manage organisations, departments, and assets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          <Toaster position="top-right" />
        </div>
      </body>
    </html>
  );
}
