import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
    title: "Terms of Service · AssetIQ",
    description: "The terms that govern use of AssetIQ.",
};

const LEGAL_CONTACT = "legal@assetiq.io";

const sections: LegalSection[] = [
    {
        heading: "Agreement",
        body: (
            <p>
                By creating a workspace or signing in, you agree to these terms on behalf of yourself and the
                organisation you represent. Where your organisation has a signed agreement with us, that agreement
                governs and these terms fill any gaps.
            </p>
        ),
    },
    {
        heading: "Accounts",
        body: (
            <p>
                You are responsible for keeping credentials secure and for activity under your account.
                Organisation administrators control who has access to their workspace and what they can do.
            </p>
        ),
    },
    {
        heading: "Acceptable use",
        body: (
            <p>
                Do not misuse the service: no attempts to access other organisations&apos; data, disrupt the
                platform, reverse-engineer it, or use it for unlawful purposes.
            </p>
        ),
    },
    {
        heading: "Your data",
        body: (
            <p>
                Your organisation owns the content it puts into AssetIQ. We process it only to provide the
                service, as described in the <a className="text-teal-400 underline" href="/privacy">Privacy Policy</a>.
            </p>
        ),
    },
    {
        heading: "Plans and billing",
        body: (
            <p>
                Paid plans are billed as set out at purchase or in your order form. Plan limits apply to assets,
                users, and features.
            </p>
        ),
    },
    {
        heading: "Availability and liability",
        body: (
            <p>
                We work to keep the service available and secure. Service levels, remedies, and limitations of
                liability are defined in your customer agreement.
            </p>
        ),
    },
    {
        heading: "Contact",
        body: (
            <p>
                <a className="text-teal-400 underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
            </p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            lastUpdated="2026-09-25"
            intro={<p>These terms govern your use of AssetIQ on the web, desktop, and mobile.</p>}
            sections={sections}
        />
    );
}
