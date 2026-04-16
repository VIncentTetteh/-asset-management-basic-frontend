"use client";

import React from "react";
import { useRouter } from "next/navigation";

/**
 * Shown when an authenticated user navigates to a page they lack
 * permission to access. Replaces a blank screen or confusing API error.
 */
export function Forbidden() {
    const router = useRouter();

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl font-bold text-gray-300">403</div>
            <h1 className="text-2xl font-semibold text-gray-700">Access Denied</h1>
            <p className="max-w-sm text-gray-500">
                You don&apos;t have permission to view this page. Contact your administrator
                if you think this is a mistake.
            </p>
            <button
                onClick={() => router.back()}
                className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
                Go back
            </button>
        </div>
    );
}
