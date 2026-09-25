import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function SupportPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />
            <main className="px-6 pb-24 pt-32">
                <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900/50 p-10 text-center">
                    <h1 className="text-4xl font-extrabold">Customer support</h1>
                    <p className="mt-5 text-lg leading-relaxed text-slate-400">
                        Existing customers should use the support channel and escalation contacts in their service agreement. A public ticket form and knowledge base will appear here only after the monitored support service is operational.
                    </p>
                    <p className="mt-6 text-sm text-slate-500">
                        No response-time or availability commitment is made by this page; contracted service levels govern.
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
