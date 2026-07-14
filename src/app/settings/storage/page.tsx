"use client";

import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { StorageSettings } from "@/components/StorageSettings";
import { PageHeader } from "@/components/ui/page-header";
import { HardDrive } from "lucide-react";

export default function StorageSettingsPage() {
    const orgId = getOrganisationIdFromStorage() ?? "";

    return (
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            <div className="flex items-center gap-3">
                <HardDrive className="h-6 w-6 text-brand" />
                <PageHeader title="Storage Settings" subtitle="Configure S3 storage for document attachments, reports, and imports" />
            </div>

            {!orgId ? (
                <div className="rounded-card border border-warn/40 bg-warn-soft px-5 py-4 text-sm text-warn">
                    No organisation context found. Please log in and select an organisation to manage storage settings.
                </div>
            ) : (
                <StorageSettings orgId={orgId} />
            )}
        </div>
    );
}
