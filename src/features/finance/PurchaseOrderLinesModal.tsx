"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { PurchaseOrder } from "@/types";

/**
 * The read-only breakdown of an order's lines.
 *
 * <p>The list row can only show a total and a count; once an order is itemised,
 * the question anyone actually has is what is on it — and after the order leaves
 * DRAFT the edit form is no longer available to answer it.
 */
export function PurchaseOrderLinesModal({
    order,
    onClose,
    formatMoney,
}: {
    order: PurchaseOrder | null;
    onClose: () => void;
    formatMoney: (amount: number) => string;
}) {
    const lines = order?.lineItems ?? [];
    return (
        <Modal
            isOpen={!!order}
            onClose={onClose}
            title={order ? `Line items · ${order.poNumber}` : "Line items"}
            description="What this order is made up of. Lines can only be changed while the order is a draft."
        >
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-1" data-testid="po-lines-view">
                {lines.length === 0 ? (
                    <p className="text-sm text-muted-fg">This order has no lines — it is a single lump sum.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-edge-subtle text-left text-xs text-muted-fg">
                                <th className="py-1.5 pr-2 font-medium">#</th>
                                <th className="py-1.5 pr-2 font-medium">Description</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Unit price</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Tax</th>
                                <th className="py-1.5 text-right font-medium">Line total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, index) => (
                                <tr key={line.id ?? index} className="border-b border-edge-subtle last:border-0">
                                    <td className="py-1.5 pr-2 text-faint-fg">{line.lineNumber ?? index + 1}</td>
                                    <td className="py-1.5 pr-2">
                                        <span className="block">{line.description}</span>
                                        {line.supplierPartNumber ? (
                                            <span className="data-mono block text-xs text-faint-fg">
                                                {line.supplierPartNumber}
                                            </span>
                                        ) : null}
                                        {line.categoryName ? (
                                            <span className="block text-xs text-faint-fg">{line.categoryName}</span>
                                        ) : null}
                                    </td>
                                    <td className="data-mono py-1.5 pr-2 text-right">{line.quantity}</td>
                                    <td className="data-mono py-1.5 pr-2 text-right">{formatMoney(line.unitPrice)}</td>
                                    <td className="data-mono py-1.5 pr-2 text-right">
                                        {line.taxRate != null ? `${line.taxRate}%` : formatMoney(line.taxAmount ?? 0)}
                                    </td>
                                    <td className="data-mono py-1.5 text-right font-semibold">
                                        {formatMoney(line.lineTotal ?? 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="py-2 text-right text-muted-fg" colSpan={5}>Order total</td>
                                <td className="data-mono py-2 text-right font-semibold" data-testid="po-lines-view-total">
                                    {formatMoney(order?.totalAmount ?? 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
            <div className="flex justify-end border-t border-edge-subtle pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
}
