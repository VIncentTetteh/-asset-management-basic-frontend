import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
    title: "Privacy Policy · AssetIQ",
    description: "How AssetIQ collects, uses, and protects personal data.",
};

const PRIVACY_CONTACT = "privacy@assetiq.io";

const sections: LegalSection[] = [
    {
        heading: "Who we are",
        body: (
            <p>
                AssetIQ provides asset lifecycle management software to organisations. For data that a customer
                organisation puts into AssetIQ, that organisation is the data controller and we process it on
                their behalf. For account and website data, we are the controller.
            </p>
        ),
    },
    {
        heading: "What we collect",
        body: (
            <ul className="list-disc space-y-2 pl-5">
                <li>Account details: name, work email, role, and organisation.</li>
                <li>Workspace content: assets, locations, assignments, maintenance, audits, and attachments you add.</li>
                <li>Security and usage data: sign-in events, device and app version, and audit logs of changes.</li>
                <li>Camera access in the mobile app is used only to scan asset labels and capture photos you choose to attach.</li>
            </ul>
        ),
    },
    {
        heading: "How we use it",
        body: (
            <p>
                To provide and secure the service, authenticate users, keep an audit trail your organisation relies
                on, provide support, and meet legal obligations. We do not sell personal data and do not use
                workspace content for advertising.
            </p>
        ),
    },
    {
        heading: "Sharing",
        body: (
            <p>
                We share data only with sub-processors that host and operate the service (for example cloud
                hosting and email delivery), under contracts that bind them to equivalent protections, or where
                the law requires it.
            </p>
        ),
    },
    {
        heading: "Retention and deletion",
        body: (
            <p>
                Workspace data is kept for the life of the customer agreement and the audit-retention period of
                the organisation&apos;s plan. Users can request deletion of their account from the mobile app
                (Profile → Delete account) or by contacting us.
            </p>
        ),
    },
    {
        heading: "Your rights",
        body: (
            <p>
                Depending on where you live, you may have rights to access, correct, export, or delete your
                personal data, and to object to or restrict processing. If your organisation manages your account,
                we will route the request to them.
            </p>
        ),
    },
    {
        heading: "Contact",
        body: (
            <p>
                Questions or requests: <a className="text-teal-400 underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
            </p>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            lastUpdated="2026-09-25"
            intro={<p>This policy explains what personal data AssetIQ handles, why, and the choices you have.</p>}
            sections={sections}
        />
    );
}
