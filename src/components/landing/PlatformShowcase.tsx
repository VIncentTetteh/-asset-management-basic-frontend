"use client";

const mockAssets = [
    { name: 'MacBook Pro 16" M3', tag: "IT-0421", dept: "Engineering", active: true },
    { name: "Forklift Unit #7", tag: "OPS-0189", dept: "Warehouse", active: false },
    { name: "Server Rack B2", tag: "INF-0053", dept: "IT Infra", active: true },
];

const sidebarItems = ["Dashboard", "Assets", "Operations", "Compliance", "Finance", "Reports", "Admin"];

const desktopRows = [
    { name: 'MacBook Pro 16"', tag: "IT-0421", dept: "Engineering", active: true, checked: true },
    { name: "Forklift Unit #7", tag: "OPS-0189", dept: "Warehouse", active: false, checked: false },
    { name: 'Dell Monitor 27"', tag: "IT-0398", dept: "Finance", active: true, checked: false },
    { name: "Server Rack B2", tag: "INF-0053", dept: "IT Infrastructure", active: true, checked: false },
];

const kpiCards = [
    { label: "Total Assets", value: "4,821", trend: "+12%", up: true, bg: "bg-teal-500/15" },
    { label: "Active", value: "3,940", trend: "+5%", up: true, bg: "bg-emerald-500/15" },
    { label: "Maintenance", value: "312", trend: "-3%", up: false, bg: "bg-blue-500/15" },
    { label: "Flagged", value: "41", trend: "-8%", up: false, bg: "bg-orange-500/15" },
];

export function PlatformShowcase() {
    return (
        <section className="relative py-20 md:py-28 overflow-hidden">
            {/* Section background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-500/[0.05] blur-[120px] rounded-full" />
            </div>

            <div className="container relative mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/[0.06] px-4 py-1.5 text-xs font-medium text-teal-400 mb-4">
                        🖥️ Multi-platform
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 mb-4">
                        One platform. <span className="text-gradient">Every device.</span>
                    </h2>
                    <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                        Whether you&apos;re at your desk, on the move, or managing from headquarters — AssetIQ delivers
                        the full asset management experience on web, desktop, and mobile.
                    </p>
                </div>

                {/* Platform grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* ══ WEB — full width ══ */}
                    <div className="md:col-span-2 bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/[0.09] blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none" />

                        {/* Card label */}
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center text-sm shrink-0">🌐</div>
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Web Application</p>
                                <p className="text-xs text-slate-500">app.assetiq.io — any browser, any OS</p>
                            </div>
                            <div className="ml-auto hidden sm:flex gap-1.5 flex-wrap">
                                {["Chrome", "Firefox", "Safari", "Edge"].map(b => (
                                    <span key={b} className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.08] text-slate-400 bg-white/[0.03]">{b}</span>
                                ))}
                            </div>
                        </div>

                        {/* Browser frame */}
                        <div className="relative z-10 bg-slate-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.05] bg-slate-900/60">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                <div className="flex-1 mx-3 h-5 rounded bg-slate-800/80 flex items-center px-2.5">
                                    <span className="text-[9px] text-slate-500 font-mono">app.assetiq.io/dashboard</span>
                                </div>
                            </div>

                            <div className="flex p-3 gap-3">
                                {/* Sidebar */}
                                <div className="w-28 bg-slate-900/60 rounded-lg p-2 shrink-0">
                                    <div className="flex items-center gap-1.5 px-1.5 py-1 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                                        <span className="text-[9px] font-bold text-slate-200">AssetIQ</span>
                                    </div>
                                    {sidebarItems.map((item, i) => (
                                        <div key={item} className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md mb-0.5 ${i === 0 ? "bg-teal-500/15" : ""}`}>
                                            <div className={`w-1.5 h-1.5 rounded-sm ${i === 0 ? "bg-teal-500" : "bg-slate-600"}`} />
                                            <span className={`text-[8px] ${i === 0 ? "text-teal-300" : "text-slate-500"}`}>{item}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Main */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="text-[10px] font-semibold text-slate-300">Dashboard Overview</span>
                                        <div className="flex gap-1.5">
                                            <div className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[8px] font-semibold">+ Add Asset</div>
                                            <div className="px-2 py-0.5 rounded border border-slate-700 text-slate-500 text-[8px]">Export</div>
                                        </div>
                                    </div>

                                    {/* KPI cards */}
                                    <div className="grid grid-cols-4 gap-2 mb-2.5">
                                        {kpiCards.map(k => (
                                            <div key={k.label} className="bg-slate-900/60 border border-white/[0.05] rounded-lg p-2">
                                                <div className={`w-5 h-5 rounded-md ${k.bg} mb-1.5`} />
                                                <p className="text-[7px] text-slate-500 uppercase tracking-wide mb-0.5">{k.label}</p>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-sm font-bold text-slate-100">{k.value}</span>
                                                    <span className={`text-[8px] font-semibold ${k.up ? "text-emerald-400" : "text-red-400"}`}>{k.trend}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Charts */}
                                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                                        <div className="col-span-2 bg-slate-900/60 border border-white/[0.05] rounded-lg p-2">
                                            <p className="text-[8px] font-semibold text-slate-500 mb-1.5">Asset Status Trend — Last 6 months</p>
                                            <div className="flex items-end gap-1.5 h-10">
                                                {[60, 75, 65, 85, 70, 90].map((h, i) => (
                                                    <div key={i} className="flex-1 bg-teal-500/70 rounded-t-sm" style={{ height: `${h}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/60 border border-white/[0.05] rounded-lg p-2 flex flex-col items-center justify-center gap-2">
                                            <p className="text-[8px] font-semibold text-slate-500">By Category</p>
                                            <div className="w-10 h-10 rounded-full" style={{ background: "conic-gradient(#0d9488 0% 62%, #3b82f6 62% 80%, #f97316 80% 90%, #334155 90% 100%)" }} />
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-slate-900/60 border border-white/[0.05] rounded-lg overflow-hidden">
                                        <div className="flex justify-between px-3 py-1.5 border-b border-white/[0.05]">
                                            <span className="text-[8px] font-semibold text-slate-400">Recent Assets</span>
                                            <span className="text-[8px] text-teal-400">View all →</span>
                                        </div>
                                        {mockAssets.map(a => (
                                            <div key={a.tag} className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] last:border-0">
                                                <div className="w-5 h-5 rounded-md bg-slate-700/60 border border-white/[0.05] shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[8px] text-slate-300 font-medium truncate">{a.name}</p>
                                                    <p className="text-[7px] text-slate-500">{a.tag} · {a.dept}</p>
                                                </div>
                                                <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold ${a.active ? "bg-teal-500/10 text-teal-400" : "bg-blue-500/10 text-blue-400"}`}>
                                                    {a.active ? "Active" : "Maint."}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ DESKTOP ══ */}
                    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/[0.07] blur-[70px] rounded-full -ml-10 -mb-10 pointer-events-none" />

                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-sm shrink-0">🖥️</div>
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Desktop Application</p>
                                <p className="text-xs text-slate-500">Native Electron — offline capable</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 mb-3 relative z-10">
                            {["Windows", "macOS", "Linux"].map(p => (
                                <span key={p} className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.08] text-slate-400 bg-white/[0.03]">{p}</span>
                            ))}
                        </div>

                        {/* Electron window */}
                        <div className="relative z-10 bg-slate-800/60 rounded-xl border border-white/[0.06] overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.05] bg-slate-900/70">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                <span className="flex-1 text-center text-[8px] text-slate-500">AssetIQ Desktop — Asset Register</span>
                            </div>
                            <div className="flex">
                                {/* Icon sidebar */}
                                <div className="w-10 bg-slate-900/50 p-1.5 flex flex-col gap-1 border-r border-white/[0.04] shrink-0">
                                    {[true, false, false, false, false, false].map((active, i) => (
                                        <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto ${active ? "bg-teal-500/20" : ""}`}>
                                            <div className={`w-2.5 h-2.5 rounded-sm ${active ? "bg-teal-500" : "bg-slate-600"}`} />
                                        </div>
                                    ))}
                                </div>
                                {/* Content */}
                                <div className="flex-1 p-2.5 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-semibold text-slate-300">Asset Register</span>
                                        <div className="flex gap-1">
                                            <div className="px-1.5 py-0.5 bg-teal-500/20 text-teal-300 rounded text-[7px] font-semibold">+ New Asset</div>
                                            <div className="px-1.5 py-0.5 border border-slate-700 text-slate-500 rounded text-[7px]">Bulk Import</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700/50 rounded-md h-5 px-2 mb-2">
                                        <div className="w-2 h-2 rounded-full border border-slate-600 shrink-0" />
                                        <span className="text-[7px] text-slate-500">Search assets, tags, departments…</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-1.5 py-1 bg-slate-900/40 rounded-md mb-1 text-[7px] font-semibold text-slate-500">
                                        <div className="w-2 h-2 border border-slate-600 rounded-sm shrink-0" />
                                        <span className="w-20 shrink-0">Asset Name</span>
                                        <span className="w-10 shrink-0">Tag</span>
                                        <span className="w-14 shrink-0">Department</span>
                                        <span>Status</span>
                                    </div>
                                    {desktopRows.map((row, i) => (
                                        <div key={row.tag} className={`flex items-center gap-2 px-1.5 py-1 rounded-md mb-0.5 text-[7px] ${i === 0 ? "bg-teal-500/[0.07]" : ""}`}>
                                            <div className={`w-2 h-2 rounded-sm shrink-0 ${row.checked ? "bg-teal-500" : "border border-slate-600"}`} />
                                            <span className="w-20 text-slate-300 font-medium truncate shrink-0">{row.name}</span>
                                            <span className="w-10 text-slate-500 shrink-0">{row.tag}</span>
                                            <span className="w-14 text-slate-500 truncate shrink-0">{row.dept}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[6px] font-bold ${row.active ? "bg-teal-500/15 text-teal-400" : "bg-blue-500/15 text-blue-400"}`}>
                                                {row.active ? "Active" : "Maint."}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ MOBILE ══ */}
                    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/[0.07] blur-[70px] rounded-full -mr-10 -mt-10 pointer-events-none" />

                        <div className="flex items-center gap-3 mb-3 w-full relative z-10">
                            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center text-sm shrink-0">📱</div>
                            <div>
                                <p className="text-sm font-semibold text-slate-200">Mobile App</p>
                                <p className="text-xs text-slate-500">Full asset access on the go</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 mb-5 w-full relative z-10">
                            {["iOS", "Android"].map(p => (
                                <span key={p} className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.08] text-slate-400 bg-white/[0.03]">{p}</span>
                            ))}
                        </div>

                        {/* Phone chassis */}
                        <div className="relative z-10">
                            {/* Hardware buttons */}
                            <div className="absolute -right-1 top-20 w-[3px] h-12 bg-slate-700 rounded-full" />
                            <div className="absolute -left-1 top-16 w-[3px] h-8 bg-slate-700 rounded-full" />
                            <div className="absolute -left-1 top-28 w-[3px] h-8 bg-slate-700 rounded-full" />

                            <div
                                className="w-[220px] bg-slate-800 rounded-[40px] border-2 border-white/[0.1] p-3"
                                style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)" }}
                            >
                                {/* Notch */}
                                <div className="relative w-16 h-3 bg-slate-950 rounded-md mx-auto mb-2">
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-600" />
                                </div>

                                {/* Screen */}
                                <div className="bg-slate-950 rounded-[26px] overflow-hidden">
                                    {/* Status bar */}
                                    <div className="flex justify-between items-center px-4 pt-2 pb-1">
                                        <span className="text-[11px] font-bold text-slate-200">9:41</span>
                                        <div className="flex items-end gap-0.5">
                                            {[4, 6, 8, 10].map((h, i) => (
                                                <div key={i} className="w-[3px] bg-slate-300 rounded-sm" style={{ height: h }} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Greeting */}
                                    <div className="px-4 pb-3">
                                        <p className="text-[10px] text-slate-500">Good morning,</p>
                                        <p className="text-sm font-bold text-slate-100 mb-2.5">IT Manager 👋</p>
                                        <div className="flex items-center gap-2 bg-slate-800 rounded-xl h-8 px-3 border border-white/[0.05]">
                                            <div className="w-3 h-3 rounded-full border-2 border-slate-600 shrink-0" />
                                            <span className="text-[10px] text-slate-500">Search assets…</span>
                                        </div>
                                    </div>

                                    {/* KPI tiles */}
                                    <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                                        {[
                                            { val: "4,821", lbl: "Total Assets", trend: "↑ 12%" },
                                            { val: "3,940", lbl: "Active", trend: "↑ 5%", teal: true },
                                        ].map(k => (
                                            <div key={k.lbl} className="bg-slate-800 rounded-xl p-2.5 border border-white/[0.05]">
                                                <p className={`text-base font-black ${k.teal ? "text-teal-400" : "text-slate-100"}`}>{k.val}</p>
                                                <p className="text-[8px] text-slate-500 uppercase tracking-wide mt-0.5">{k.lbl}</p>
                                                <p className="text-[9px] font-semibold text-emerald-400 mt-0.5">{k.trend}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Recent assets */}
                                    <div className="flex justify-between items-center px-4 pb-2">
                                        <span className="text-[10px] font-semibold text-slate-400">Recent Assets</span>
                                        <span className="text-[10px] text-teal-400">See all</span>
                                    </div>
                                    <div className="px-3 pb-2 flex flex-col gap-1.5">
                                        {[
                                            { name: 'MacBook Pro 16"', sub: "IT-0421 · Engineering", active: true },
                                            { name: "Forklift Unit #7", sub: "OPS-0189 · Warehouse", active: false },
                                            { name: "Server Rack B2", sub: "INF-0053 · IT Infra", active: true },
                                        ].map(a => (
                                            <div key={a.sub} className="flex items-center gap-2 bg-slate-800 rounded-xl p-2 border border-white/[0.05]">
                                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${a.active ? "bg-teal-500/20" : "bg-blue-500/20"}`}>
                                                    <div className={`w-3 h-3 rounded-sm ${a.active ? "bg-teal-500" : "bg-blue-400"}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] text-slate-200 font-medium truncate">{a.name}</p>
                                                    <p className="text-[8px] text-slate-500">{a.sub}</p>
                                                </div>
                                                <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-bold whitespace-nowrap ${a.active ? "bg-teal-500/20 text-teal-400" : "bg-blue-500/20 text-blue-400"}`}>
                                                    {a.active ? "Active" : "Maint."}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tab bar */}
                                    <div className="flex justify-around items-center px-2 py-2.5 border-t border-white/[0.06] bg-slate-900/60">
                                        {["Home", "Assets", "Ops", "More"].map((lbl, i) => (
                                            <div key={lbl} className="flex flex-col items-center gap-1">
                                                <div className={`w-5 h-1 rounded-full ${i === 0 ? "bg-teal-500" : "bg-slate-700"}`} />
                                                <span className={`text-[8px] ${i === 0 ? "text-teal-400 font-semibold" : "text-slate-500"}`}>{lbl}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Home indicator */}
                                <div className="w-14 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
