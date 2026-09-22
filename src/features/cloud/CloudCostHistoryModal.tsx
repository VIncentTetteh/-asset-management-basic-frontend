"use client";

import { useEffect, useState } from "react";
import type { CloudAsset, CloudCostRecord } from "@/types";
import { cloudAssetService } from "@/services/cloudAssetService";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { reportApiError } from "@/lib/api-validation";
import { formatBillingMonth } from "@/features/cloud/options";

const PAGE_SIZE = 24;

/** Recorded monthly costs of one cloud asset, newest month first, loaded a page at a time. */
export function CloudCostHistoryModal({ asset, onClose }: { asset: CloudAsset | null; onClose: () => void }) {
    const { format, baseCurrency } = useCurrency();
    const [records, setRecords] = useState<CloudCostRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const load = async (assetId: string, offset: number) => {
        setIsLoading(true);
        try {
            const page = await cloudAssetService.getCosts(assetId, { limit: PAGE_SIZE, offset });
            const items = page.items ?? page.content ?? [];
            setRecords((prev) => (offset === 0 ? items : [...prev, ...items]));
            setTotal(page.total ?? items.length);
        } catch (err) {
            reportApiError(err, { fallback: "Failed to load cost history" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!asset) return;
        setRecords([]);
        setTotal(0);
        void load(asset.id, 0);
    }, [asset]);

    return (
        <Modal
            isOpen={asset !== null}
            onClose={onClose}
            title={`Cost history${asset ? ` — ${asset.name}` : ""}`}
            description="Recorded monthly costs, newest first. Recording a month and service again replaces it."
        >
            {isLoading && records.length === 0 ? (
                <div className="flex h-32 items-center justify-center"><PageSpinner /></div>
            ) : records.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-fg">No costs recorded yet.</p>
            ) : (
                <div className="space-y-3">
                    <div className="max-h-[50vh] overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-edge-subtle text-left text-muted-fg">
                                    <th className="py-2 pr-4 font-medium">Month</th>
                                    <th className="py-2 pr-4 font-medium">Service</th>
                                    <th className="py-2 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((r) => (
                                    <tr key={r.id} className="border-b border-edge-subtle">
                                        <td className="py-2 pr-4 text-foreground">{formatBillingMonth(r.billingMonth)}</td>
                                        <td className="py-2 pr-4 text-muted-fg">{r.serviceName || "Whole asset"}</td>
                                        <td className="data-mono py-2 text-right">
                                            {format(r.amount, r.currency || asset?.currency || baseCurrency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {records.length < total && asset ? (
                        <div className="flex justify-center">
                            <Button variant="outline" size="sm" isLoading={isLoading} onClick={() => void load(asset.id, records.length)}>
                                Load older months
                            </Button>
                        </div>
                    ) : null}
                </div>
            )}
        </Modal>
    );
}
