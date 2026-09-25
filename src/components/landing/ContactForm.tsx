import Link from "next/link";

/**
 * Honest commercial-contact fallback. A form must not be shown until a real,
 * monitored CRM/support submission endpoint is configured end to end.
 */
export function ContactForm() {
    const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL?.trim();

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Commercial enquiries</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Sales and support channels are provisioned with each customer agreement. We do not collect enquiry data on this page until the monitored case-management service is enabled.
            </p>
            {salesEmail ? (
                <Link
                    href={`mailto:${salesEmail}?subject=AssetIQ%20commercial%20enquiry`}
                    className="mt-6 inline-flex rounded-lg bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
                >
                    Email the commercial team
                </Link>
            ) : (
                <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Contact details are being configured. Existing customers should use the channel named in their agreement.
                </p>
            )}
        </div>
    );
}
