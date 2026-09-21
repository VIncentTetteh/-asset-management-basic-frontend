"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, ExternalLink, PackageCheck, QrCode, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetTag } from "@/components/ui/asset-tag";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSpinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/contexts/PermissionContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatMoney } from "@/lib/currency";
import { normalizeAssetHistoryEntry } from "@/lib/assetHistory";
import { loginPathWithNext } from "@/lib/safe-next";
import { isNotFoundOrForbidden, parseScannedAssetId, useScannedAsset } from "@/features/assets/scan";
import type { Asset } from "@/types";

const NOT_FOUND_MESSAGE = "Asset not found or you don't have access to it.";

const humanize = (value?: string | null): string =>
    value ? value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

const formatDate = (value?: string | null): string => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

function Notice({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            <QrCode className="h-10 w-10 text-faint-fg" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {children}
            <Button asChild variant="outline" size="sm">
                <Link href="/assets">Go to assets</Link>
            </Button>
        </div>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="text-sm text-muted-fg">{label}</dt>
            <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
        </div>
    );
}

function AssetActions({ asset }: { asset: Asset }) {
    const canViewAssets = usePermission("VIEW_ASSETS");
    const canCheckout = usePermission("CHECKOUT_ASSET");
    const canTransfer = usePermission("TRANSFER_ASSET");
    const canMaintain = usePermission("VIEW_MAINTENANCE");
    const assetLink = `/assets?${new URLSearchParams({ q: asset.assetTag || asset.name, id: asset.id }).toString()}`;

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canViewAssets ? (
                <Button asChild className="w-full">
                    <Link href={assetLink}><ExternalLink className="mr-2 h-4 w-4" />Open full asset</Link>
                </Button>
            ) : null}
            {canCheckout ? (
                <Button asChild variant="outline" className="w-full">
                    <Link href="/checkouts"><PackageCheck className="mr-2 h-4 w-4" />Check out / in</Link>
                </Button>
            ) : null}
            {canTransfer ? (
                <Button asChild variant="outline" className="w-full">
                    <Link href="/transfers"><ArrowLeftRight className="mr-2 h-4 w-4" />Transfer</Link>
                </Button>
            ) : null}
            {canMaintain ? (
                <Button asChild variant="outline" className="w-full">
                    <Link href="/maintenance"><Wrench className="mr-2 h-4 w-4" />Maintenance</Link>
                </Button>
            ) : null}
        </div>
    );
}

function AssetSummary({ assetId }: { assetId: string }) {
    const { asset, history, nextMaintenance, names } = useScannedAsset(assetId, true);
    const { baseCurrency } = useCurrency();

    if (asset.isLoading) return <PageSpinner label="Loading asset…" />;
    if (asset.isError) {
        return isNotFoundOrForbidden(asset.error) ? (
            <Notice title={NOT_FOUND_MESSAGE} />
        ) : (
            <Notice title="We couldn't load this asset.">
                <Button size="sm" onClick={() => void asset.refetch()}>Try again</Button>
            </Notice>
        );
    }
    const data = asset.data;
    if (!data) return <Notice title={NOT_FOUND_MESSAGE} />;

    const currency = data.currency || baseCurrency;
    const events = (history.data ?? []).map(normalizeAssetHistoryEntry);

    return (
        <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.1em] text-faint-fg">Asset summary</p>
                {data.assetTag ? <AssetTag tag={data.assetTag} /> : null}
                <h1 className="text-xl font-semibold text-foreground">{data.name}</h1>
                {data.status ? <StatusBadge status={String(data.status)} /> : null}
            </div>

            <AssetActions asset={data} />

            <Card>
                <CardContent className="pt-4">
                    <dl className="divide-y divide-edge-subtle">
                        <Fact label="Condition">{humanize(data.condition ? String(data.condition) : null)}</Fact>
                        <Fact label="Category">{names.category ?? (data.categoryId ? "—" : "Uncategorised")}</Fact>
                        <Fact label="Location">{names.location ?? (data.locationId ? "—" : "Not set")}</Fact>
                        <Fact label="Department">{names.department ?? (data.departmentId ? "—" : "Not set")}</Fact>
                        <Fact label="Assigned to">{names.assignee ?? (data.assignedUserId ? "Assigned" : "Unassigned")}</Fact>
                        <Fact label="Purchase cost">
                            {data.purchaseCost != null ? formatMoney(data.purchaseCost, currency) : "—"}
                        </Fact>
                        {data.currentBookValue != null ? (
                            <Fact label="Current book value">
                                {formatMoney(data.currentBookValue, currency)}
                                {data.depreciationConfigured === false ? (
                                    <span className="ml-1 text-xs text-muted-fg">(at cost, depreciation not set up)</span>
                                ) : null}
                            </Fact>
                        ) : null}
                        <Fact label="Warranty expiry">{formatDate(data.warrantyExpiryDate)}</Fact>
                        {nextMaintenance ? <Fact label="Next maintenance">{formatDate(nextMaintenance)}</Fact> : null}
                    </dl>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {history.isLoading ? (
                        <p className="text-sm text-muted-fg">Loading…</p>
                    ) : events.length === 0 ? (
                        <p className="text-sm text-muted-fg">No recorded activity yet.</p>
                    ) : (
                        <ol className="space-y-3">
                            {events.map((event, index) => (
                                <li key={event.id ?? `${event.label}-${index}`} className="text-sm">
                                    <p className="font-medium text-foreground">{event.label}</p>
                                    <p className="text-xs text-muted-fg">
                                        {event.timeLabel}{event.userName ? ` · ${event.userName}` : ""}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ScanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isReady, isAuthenticated } = useAuth();
    const raw = searchParams.get("a");
    const assetId = parseScannedAssetId(raw);

    useEffect(() => {
        if (!isReady || isAuthenticated) return;
        const back = raw ? `/scan?a=${encodeURIComponent(raw)}` : "/scan";
        router.replace(loginPathWithNext(back));
    }, [isReady, isAuthenticated, raw, router]);

    if (!isReady || !isAuthenticated) return <PageSpinner label="Checking your session…" />;

    if (!raw) {
        return (
            <Notice title="No asset in this link.">
                <p className="text-sm text-muted-fg">Scan an asset&apos;s QR label to see its summary here.</p>
            </Notice>
        );
    }
    if (!assetId) {
        return (
            <Notice title="This QR code isn't a valid asset label.">
                <p className="text-sm text-muted-fg">Check you scanned an AssetIQ label, or search for the asset instead.</p>
            </Notice>
        );
    }
    return <AssetSummary assetId={assetId} />;
}

/**
 * Landing page for printed asset QR labels (`/scan?a=<uuid>`). A static route
 * with the id in the query string, so it works in the static export.
 */
export default function ScanPage() {
    // useSearchParams needs a Suspense boundary for the static export build.
    return (
        <Suspense fallback={<PageSpinner />}>
            <ScanContent />
        </Suspense>
    );
}
