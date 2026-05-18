"use client";

/**
 * Storage Settings Page
 * Route: /settings/storage
 *
 * Allows org admins to configure per-organisation S3 storage:
 * enable/disable S3, set the bucket name, key prefixes, and presigned URL TTL.
 */

import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { StorageSettings } from "@/components/StorageSettings";
import { HardDrive } from "lucide-react";

export default function StorageSettingsPage() {
    const orgId = getOrganisationIdFromStorage() ?? "";

    return (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <HardDrive className="h-6 w-6 text-teal-600" />
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Storage Settings</h1>
                    <p className="text-sm text-slate-500">
                        Configure S3 storage for document attachments, reports, and imports
                    </p>
                </div>
            </div>

            {!orgId ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    No organisation context found. Please log in and select an organisation to manage storage settings.
                </div>
            ) : (
                <StorageSettings orgId={orgId} />
            )}
        </div>
    );
}
