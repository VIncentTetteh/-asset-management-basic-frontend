"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { PlatformShowcase } from "@/components/landing/PlatformShowcase";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { ContactForm } from "@/components/landing/ContactForm";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500/30">
            <Navbar />

            <main>
                <Hero />

                <PlatformShowcase />

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
                                            "Explicit tenant and permission controls",
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

                <section id="contact-info" className="py-24 bg-slate-900/30 border-y border-white/5">
                    <div className="container mx-auto px-6">
                        <div className="grid gap-12 lg:grid-cols-2 items-center">
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h2 className="text-3xl font-bold text-white md:text-5xl">We&apos;re here to <br /><span className="text-gradient">support your growth.</span></h2>
                                    <p className="text-slate-400 text-lg max-w-xl">
                                        Commercial and support channels are agreed during onboarding. Public contact details and service-level claims are shown only after they are operationally verified.
                                    </p>
                                </div>

                                <p className="text-sm text-slate-300">Contracted support hours, severity definitions, escalation paths, availability targets, and remedies are documented per customer agreement.</p>
                            </div>

                            <div className="animate-slide-up">
                                <div className="mb-4 text-center lg:text-left">
                                    <span className="text-xs font-bold uppercase tracking-widest text-teal-300">Commercial enquiry</span>
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
                            <a href="/register-tenant" className="inline-flex h-14 items-center justify-center rounded-xl bg-teal-700 px-10 text-lg font-bold text-white shadow-xl shadow-teal-900/40 transition-all hover:scale-105 hover:bg-teal-800 active:scale-95">
                                Register an evaluation workspace
                            </a>
                            <a href="/contact" className="inline-flex h-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 px-10 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-slate-800 active:scale-95">
                                Commercial onboarding
                            </a>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-teal-500/5 to-transparent pointer-events-none" />
                </section>
            </main>

            <Footer />

        </div>
    );
}
