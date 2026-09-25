import type { ReactNode } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export interface LegalSection {
    heading: string;
    body: ReactNode;
}

interface LegalPageProps {
    title: string;
    /** ISO date the text was last revised; rendered as-is. */
    lastUpdated: string;
    intro: ReactNode;
    sections: LegalSection[];
}

/**
 * Shared shell for public legal documents (privacy, terms).
 *
 * The banner stays until counsel approves the wording — the pages exist now so
 * the mobile app has a reachable privacy URL for store review, not because the
 * text is final.
 */
export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />

            <main className="pt-32 pb-24">
                <article className="container mx-auto max-w-3xl px-6">
                    <div
                        role="note"
                        className="mb-10 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
                    >
                        Draft pending legal review. Your signed customer agreement takes precedence over this page.
                    </div>

                    <h1 className="text-4xl font-extrabold text-white md:text-5xl">{title}</h1>
                    <p className="mt-3 text-sm text-slate-500">Last updated {lastUpdated}</p>

                    <div className="mt-8 text-base leading-relaxed text-slate-300">{intro}</div>

                    {sections.map((section) => (
                        <section key={section.heading} className="mt-10">
                            <h2 className="text-xl font-bold text-white">{section.heading}</h2>
                            <div className="mt-3 space-y-3 text-base leading-relaxed text-slate-300">{section.body}</div>
                        </section>
                    ))}
                </article>
            </main>

            <Footer />
        </div>
    );
}
