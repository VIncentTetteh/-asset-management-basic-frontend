"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ContactForm } from "@/components/landing/ContactForm";
import { ChevronRight, HelpCircle, Book, LifeBuoy, FileText } from "lucide-react";

const helpCategories = [
    {
        title: "Getting Started",
        description: "Everything you need to set up your first organisation and register assets.",
        icon: Book,
        links: ["Account Activation", "Initial Data Import", "User Role Basics", "Setting Up Departments"]
    },
    {
        title: "Asset Management",
        description: "Learn how to track lifecycle, maintenance, and complex organisation transfers.",
        icon: LifeBuoy,
        links: ["Asset Categories", "Maintenance Schedules", "Inter-dept Transfers", "Disposal Workflows"]
    },
    {
        title: "Billing & Plans",
        description: "Information about subscriptions, limits, payment methods and invoices.",
        icon: FileText,
        links: ["Changing Subscription", "Billing History", "Seat Limits", "Payment Failures"]
    }
];

export default function SupportPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />

            <main className="pt-32 pb-24">
                <div className="container mx-auto px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-16 animate-fade-in">
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">How can we <span className="text-gradient">help?</span></h1>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                Search our documentation or reach out to our global support team for assistance with your account.
                            </p>

                            <div className="mt-10 max-w-xl mx-auto relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <HelpCircle className="h-5 w-5 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search for articles, guides..."
                                    className="w-full h-14 pl-12 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xl"
                                />
                            </div>
                        </div>

                        <div className="grid gap-8 md:grid-cols-3 mb-24 animate-slide-up">
                            {helpCategories.map((cat, i) => (
                                <div key={i} className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all group">
                                    <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <cat.icon className="h-6 w-6 text-teal-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{cat.title}</h3>
                                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">{cat.description}</p>
                                    <ul className="space-y-3">
                                        {cat.links.map((link, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm text-slate-300 hover:text-teal-400 transition-colors cursor-pointer group/link">
                                                <ChevronRight className="h-4 w-4 text-slate-600 group-hover/link:text-teal-400" />
                                                {link}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-12 md:grid-cols-2 items-center bg-slate-900/20 rounded-3xl p-8 md:p-16 border border-white/5">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6">Didn't find what you needed?</h2>
                                <p className="text-slate-400 mb-8 leading-relaxed">
                                    Our technical support team is available 24/7 for Enterprise customers.
                                    Average response time is under 15 minutes for critical tickets.
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                        <span>Live Chat Support</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                        <span>Community Forum Access</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-300">
                                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                        <span>Personal Success Manager</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="mb-4 text-center md:text-left">
                                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Submit a Ticket</span>
                                </div>
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
