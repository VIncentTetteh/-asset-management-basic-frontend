import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ContactForm } from "@/components/landing/ContactForm";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />
            <main className="px-6 pb-24 pt-32">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-4xl font-extrabold md:text-5xl">Talk to the AssetIQ team</h1>
                    <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
                        Discuss a controlled evaluation, enterprise deployment requirements, data residency, integrations, or procurement.
                    </p>
                    <div className="mt-12 text-left"><ContactForm /></div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
