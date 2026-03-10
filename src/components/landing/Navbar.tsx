"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled ? "glass-dark py-3 shadow-lg" : "bg-transparent py-5"}`}>
            <div className="container mx-auto flex items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 shadow-lg group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                        <span className="text-white font-black text-xs select-none">IQ</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">
                        Asset<span className="text-teal-400">IQ</span>
                    </span>
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    <Link href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</Link>
                    <Link href="#pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</Link>
                    <Link href="/#contact-info" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Support</Link>
                    <Link href="/#contact-info" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Contact</Link>
                </div>

                <div className="hidden md:flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                        Login
                    </Link>
                    <Button asChild className="bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-900/20">
                        <Link href="/register-tenant">Start Free Trial</Link>
                    </Button>
                </div>

                <button
                    className="md:hidden text-slate-300 hover:text-white transition-colors p-1"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {mobileOpen && (
                <div className="md:hidden glass-dark border-t border-white/10 px-6 py-4 space-y-1">
                    <Link href="#features" className="block text-sm font-medium text-slate-300 hover:text-white py-2.5" onClick={() => setMobileOpen(false)}>Features</Link>
                    <Link href="#pricing" className="block text-sm font-medium text-slate-300 hover:text-white py-2.5" onClick={() => setMobileOpen(false)}>Pricing</Link>
                    <Link href="/#contact-info" className="block text-sm font-medium text-slate-300 hover:text-white py-2.5" onClick={() => setMobileOpen(false)}>Support</Link>
                    <Link href="/#contact-info" className="block text-sm font-medium text-slate-300 hover:text-white py-2.5" onClick={() => setMobileOpen(false)}>Contact</Link>
                    <div className="pt-3 flex flex-col gap-3 border-t border-white/10">
                        <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white py-1">Login</Link>
                        <Button asChild className="bg-teal-600 hover:bg-teal-700 w-full">
                            <Link href="/register-tenant">Start Free Trial</Link>
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
}
