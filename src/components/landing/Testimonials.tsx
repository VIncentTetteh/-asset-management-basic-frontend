"use client";

const testimonials = [
    {
        quote: "AssetIQ gave us complete visibility across 3,000+ assets in 14 countries. The depreciation and compliance reports alone saved our finance team weeks every quarter.",
        name: "Kwame Asante",
        title: "CFO, AfriProcure Ltd",
        initials: "KA",
        color: "bg-teal-500/20 text-teal-400",
    },
    {
        quote: "We switched from spreadsheets to AssetIQ in under a week. The onboarding was smooth and the multi-currency support was exactly what our Ghana operations needed.",
        name: "Ama Boateng",
        title: "Head of IT, GoldCoast Logistics",
        initials: "AB",
        color: "bg-blue-500/20 text-blue-400",
    },
    {
        quote: "Role-based access and real-time audit trails made our ISO 27001 audit significantly easier. The platform is genuinely enterprise-grade.",
        name: "David Osei-Mensah",
        title: "IT Director, Meridian Bank",
        initials: "DO",
        color: "bg-purple-500/20 text-purple-400",
    },
    {
        quote: "Maintenance scheduling and cost tracking is now automated. We've reduced unplanned downtime by 40% since deploying AssetIQ across our factory floor.",
        name: "Priya Nair",
        title: "Operations Manager, BrightMfg",
        initials: "PN",
        color: "bg-emerald-500/20 text-emerald-400",
    },
];

export function Testimonials() {
    return (
        <section className="py-24 bg-slate-950">
            <div className="container mx-auto px-6">
                <div className="mb-16 text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Customer Stories</span>
                    <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                        Trusted by teams that <span className="text-teal-400">can&apos;t afford surprises.</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                        From logistics to banking, AssetIQ helps organisations of every size govern what matters.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {testimonials.map((t, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 hover:border-slate-700 transition-colors"
                        >
                            {/* Stars */}
                            <div className="flex gap-1">
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <svg key={j} className="h-4 w-4 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                ))}
                            </div>

                            <p className="flex-1 text-slate-300 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>

                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${t.color}`}>
                                    {t.initials}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{t.name}</p>
                                    <p className="text-xs text-slate-500">{t.title}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
