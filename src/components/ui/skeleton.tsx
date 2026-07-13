"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-surface-sunken",
                className
            )}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="rounded-card border border-edge bg-surface overflow-hidden shadow-sm">
            <div className="p-4 border-b border-edge-subtle bg-surface-muted">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <Skeleton className="h-5 w-2/3 mb-2" />
                        <Skeleton className="h-3.5 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Skeleton className="h-3 w-12 mb-1.5" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                    <div>
                        <Skeleton className="h-3 w-16 mb-1.5" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                </div>
                <div className="pt-2 border-t border-edge-subtle space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        </div>
    );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
    return (
        <tr className="border-b border-edge-subtle">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="py-3 px-4">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

export function StatCardSkeleton() {
    return (
        <div className="rounded-card border border-edge bg-surface p-5">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-6 w-28" />
                </div>
            </div>
        </div>
    );
}
