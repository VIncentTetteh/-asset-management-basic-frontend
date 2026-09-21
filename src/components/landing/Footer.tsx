import Link from "next/link";

export function Footer() {
    return (
        <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-400">
            <div className="container mx-auto px-6">
                <div className="flex flex-col justify-between gap-8 md:flex-row">
                    <div className="max-w-lg space-y-4">
                        <div className="flex items-center gap-2 text-white">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700"><span className="text-[10px] font-black text-white">IQ</span></div>
                            <span className="text-lg font-bold">Asset<span className="text-teal-400">IQ</span></span>
                        </div>
                        <p className="text-sm leading-relaxed">
                            Asset lifecycle, procurement, operations, and control evidence in one governed workspace.
                        </p>
                    </div>
                    <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                        <Link href="/contact" className="hover:text-white">Contact</Link>
                        <Link href="/support" className="hover:text-white">Support</Link>
                        <Link href="/register-tenant" className="hover:text-white">Create workspace</Link>
                        <Link href="/login" className="hover:text-white">Sign in</Link>
                    </nav>
                </div>
                <div className="mt-10 border-t border-slate-800 pt-6 text-xs">
                    © {new Date().getFullYear()} AssetIQ. Contracted terms, privacy notices, and service levels are supplied during customer onboarding until public legal pages are approved.
                </div>
            </div>
        </footer>
    );
}
