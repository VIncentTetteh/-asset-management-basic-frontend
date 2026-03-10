"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ContactForm } from "@/components/landing/ContactForm";
import { Mail, MapPin, Phone } from "lucide-react";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />

            <main className="pt-32 pb-24">
                <div className="container mx-auto px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-16 animate-fade-in">
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Let's talk <span className="text-gradient">business.</span></h1>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                Have questions about our enterprise plans, custom integrations, or just want to see a live demo? Our team is here to help.
                            </p>
                        </div>

                        <div className="grid gap-12 md:grid-cols-3">
                            <div className="md:col-span-1 space-y-8 animate-slide-up">
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                                            <Mail className="h-5 w-5 text-teal-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Email Us</h3>
                                            <p className="text-sm text-slate-400">sales@enterpriseasset.com</p>
                                            <p className="text-sm text-slate-400">support@enterpriseasset.com</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                            <Phone className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Call Us</h3>
                                            <p className="text-sm text-slate-400">+1 (888) 123-4567</p>
                                            <p className="text-sm text-slate-400">Mon-Fri, 9am - 6pm EST</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                            <MapPin className="h-5 w-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">Office</h3>
                                            <p className="text-sm text-slate-400">123 Enterprise Way</p>
                                            <p className="text-sm text-slate-400">Silicon Valley, CA 94025</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                                    <h4 className="font-bold text-white mb-2">Technical Support?</h4>
                                    <p className="text-sm text-slate-400 mb-4">
                                        Existing customers can access priority support via their dashboard or our helper portal.
                                    </p>
                                    <a href="/support" className="text-sm font-bold text-teal-400 hover:text-teal-300 transition-colors">
                                        Visit Support Portal →
                                    </a>
                                </div>
                            </div>

                            <div className="md:col-span-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                <ContactForm />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
