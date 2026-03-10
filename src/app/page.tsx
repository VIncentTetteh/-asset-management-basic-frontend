"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { PricingSection } from "@/components/landing/PricingSection";
import { ContactForm } from "@/components/landing/ContactForm";
import { Footer } from "@/components/landing/Footer";
import { Mail, Phone } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500/30">
            <Navbar />

            <main>
                <Hero />

                <section className="py-20 bg-slate-900/10">
                    <div className="container mx-auto px-6">
                        <div className="rounded-3xl glass p-12 border border-white/5 shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[100px] -mr-32 -mt-32 transition-colors duration-500 group-hover:bg-teal-500/20" />
                            <div className="relative z-10 grid gap-12 md:grid-cols-2 items-center">
                                <div>
                                    <h2 className="text-3xl font-bold md:text-4xl mb-6">Designed for scale. Built for reliability.</h2>
                                    <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                        Managing thousands of high-value assets shouldn&apos;t be a headache.
                                        Our platform brings together procurement, finance, and operations
                                        into a single source of truth.
                                    </p>
                                    <div className="space-y-4">
                                        {[
                                            "99.9% Platform Uptime Guarantee",
                                            "Enterprise-Grade SSO & SAML Integration",
                                            "Real-time Audit Traceability",
                                            "Custom Reporting Engine"
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                                                <span className="text-slate-300 font-medium">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="hidden md:block">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-4 pt-12">
                                            <div className="h-40 rounded-2xl bg-slate-800/50 border border-white/5 p-6 animate-float">
                                                <div className="h-2 w-12 rounded bg-teal-500/50 mb-4" />
                                                <div className="h-2 w-full rounded bg-slate-700/50 mb-2" />
                                                <div className="h-2 w-2/3 rounded bg-slate-700/50" />
                                            </div>
                                            <div className="h-32 rounded-2xl bg-slate-800/50 border border-white/5 p-6">
                                                <div className="h-8 w-8 rounded-full bg-blue-500/30 mb-4" />
                                                <div className="h-2 w-full rounded bg-slate-700/50" />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="h-32 rounded-2xl bg-slate-800/50 border border-white/5 p-6">
                                                <div className="flex gap-2 mb-4">
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                    <div className="h-2 w-10 rounded bg-slate-700/50" />
                                                </div>
                                                <div className="h-2 w-full rounded bg-slate-700/50" />
                                            </div>
                                            <div className="h-48 rounded-2xl bg-slate-800/50 border border-white/5 p-6 animate-float" style={{ animationDelay: '1s' }}>
                                                <div className="h-2 w-16 rounded bg-purple-500/50 mb-4" />
                                                <div className="h-2 w-full rounded bg-slate-700/50 mb-2" />
                                                <div className="h-2 w-full rounded bg-slate-700/50 mb-2" />
                                                <div className="h-2 w-1/2 rounded bg-slate-700/50" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <FeaturesGrid />

                <PricingSection />

                <section id="contact-info" className="py-24 bg-slate-900/30 border-y border-white/5">
                    <div className="container mx-auto px-6">
                        <div className="grid gap-12 lg:grid-cols-2 items-center">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h2 className="text-3xl font-bold text-white md:text-5xl">We&apos;re here to <br /><span className="text-gradient">support your growth.</span></h2>
                                    <p className="text-slate-400 text-lg max-w-xl">
                                        Our global support team is available across time zones to ensure your enterprise stays aligned and your assets remain governed.
                                    </p>
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div className="p-6 rounded-2xl glass border-white/10">
                                        <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-4">
                                            <Mail className="h-5 w-5 text-teal-400" />
                                        </div>
                                        <h4 className="font-bold text-white mb-1">Email Support</h4>
                                        <p className="text-sm text-slate-400">Response within 2 hours</p>
                                        <p className="text-sm font-medium text-teal-400 mt-2">support@assetiq.io</p>
                                    </div>
                                    <div className="p-6 rounded-2xl glass border-white/10">
                                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                                            <Phone className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <h4 className="font-bold text-white mb-1">Direct Hotline</h4>
                                        <p className="text-sm text-slate-400">24/7 Priority sales</p>
                                        <p className="text-sm font-medium text-blue-400 mt-2">+1 (888) 123-4567</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="text-center px-4 border-r border-slate-800">
                                        <p className="text-2xl font-bold text-white">99.9%</p>
                                        <p className="text-xs text-slate-500 uppercase">Uptime</p>
                                    </div>
                                    <div className="text-center px-4 border-r border-slate-800">
                                        <p className="text-2xl font-bold text-white">&lt; 15m</p>
                                        <p className="text-xs text-slate-500 uppercase">Avg Response</p>
                                    </div>
                                    <div className="text-center px-4">
                                        <p className="text-2xl font-bold text-white">24/7</p>
                                        <p className="text-xs text-slate-500 uppercase">Availability</p>
                                    </div>
                                </div>
                            </div>

                            <div className="animate-slide-up">
                                <div className="mb-4 text-center lg:text-left">
                                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Fast Inquiry</span>
                                </div>
                                <div className="bg-slate-900/50 p-1 rounded-2xl border border-white/5">
                                    <ContactForm />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-24 relative overflow-hidden">
                    <div className="container mx-auto px-6 text-center relative z-10">
                        <h2 className="text-3xl font-bold text-white md:text-5xl mb-8">Ready to transform your <br /><span className="text-gradient">asset management?</span></h2>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button className="h-14 px-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-lg font-bold text-white transition-all shadow-xl shadow-teal-900/40 hover:scale-105 active:scale-95">
                                Start Free Trial Today
                            </button>
                            <button className="h-14 px-10 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-lg font-bold text-white transition-all hover:scale-105 active:scale-95">
                                Schedule a Demo
                            </button>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-teal-500/5 to-transparent pointer-events-none" />
                </section>
            </main>

            <Footer />

            {/* Floating WhatsApp button */}
            <a
                href="https://wa.me/18881234567"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with us on WhatsApp"
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg hover:bg-[#1ebe5d] hover:scale-110 active:scale-95 transition-all duration-200 group"
            >
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="absolute right-16 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg pointer-events-none">
                    Chat with us
                </span>
            </a>
        </div>
    );
}
