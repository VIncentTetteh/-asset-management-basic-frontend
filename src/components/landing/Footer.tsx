"use client";

import Link from "next/link";
import { Phone, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-400 transition-all">
            <div className="container mx-auto px-6">
                <div className="grid gap-12 md:grid-cols-4">
                    <div className="col-span-2 space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center">
                                <span className="text-white font-black text-[10px] select-none">IQ</span>
                            </div>
                            <span className="text-lg font-bold">Asset<span className="text-teal-400">IQ</span></span>
                        </div>
                        <p className="max-w-xs text-sm leading-relaxed">
                            The industry standard for managing organizational assets, procurement, and compliance at scale. Built for modern enterprises.
                        </p>
                        <div className="flex gap-4 pt-2">
                            {/* X (Twitter) */}
                            <Link href="#" className="hover:text-teal-400 transition-colors" aria-label="X / Twitter">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </Link>
                            {/* LinkedIn */}
                            <Link href="#" className="hover:text-teal-400 transition-colors" aria-label="LinkedIn">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </Link>
                            {/* GitHub */}
                            <Link href="#" className="hover:text-teal-400 transition-colors" aria-label="GitHub">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-4 font-semibold text-white">Support</h4>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                                <span className="hover:text-white transition-colors cursor-pointer">support@assetiq.io</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                                <span className="hover:text-white transition-colors cursor-pointer">+1 (888) 123-4567</span>
                            </li>
                            <li><Link href="/#contact-info" className="hover:text-white transition-colors">Help Center</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">Service Status</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 font-semibold text-white">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/#contact-info" className="hover:text-white transition-colors">Contact Us</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">Submit Feedback</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">About</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                    <p>© {new Date().getFullYear()} AssetIQ. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
                        <Link href="#" className="hover:text-white transition-colors">Cookie Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
