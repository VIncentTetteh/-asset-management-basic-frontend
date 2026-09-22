/**
 * Purchase-order line arithmetic, mirroring the backend's PurchaseOrderTotals
 * exactly.
 *
 * <p>The server is the authority: whatever it stores is what the supplier is
 * owed. This exists so the form can show a running total that agrees with what
 * will come back, rather than one that quietly differs in the last decimal
 * place — which is exactly the kind of mismatch a buyer notices on the printed
 * order and nowhere else.
 *
 * Money is carried at the column scale (4dp per line, 2dp for the order total)
 * and rounded half-up, like the ledger.
 */

/** po_line_item.unit_price / line_total / tax_amount are NUMERIC(19,4). */
export const LINE_SCALE = 4;
/** purchase_order.total_amount is NUMERIC(15,2). */
export const ORDER_SCALE = 2;

/** Half-up to `scale` decimals, without the float surprises of toFixed alone. */
export function roundTo(value: number, scale: number): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** scale;
    // Nudged by Number.EPSILON so 1.005 rounds up rather than down on a binary float.
    return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

const num = (value: unknown): number => {
    if (value === undefined || value === null || value === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** quantity x unit price, before tax. */
export function netOf(quantity: unknown, unitPrice: unknown): number {
    return roundTo(num(quantity) * num(unitPrice), LINE_SCALE);
}

/**
 * The tax a line carries. A tax rate wins over a typed amount, the same way the
 * server resolves it — the rate is what was agreed.
 */
export function taxOf(net: number, taxRate: unknown, taxAmount: unknown): number {
    if (taxRate !== undefined && taxRate !== null && taxRate !== "") {
        return roundTo((net * num(taxRate)) / 100, LINE_SCALE);
    }
    if (taxAmount !== undefined && taxAmount !== null && taxAmount !== "") {
        return roundTo(num(taxAmount), LINE_SCALE);
    }
    return 0;
}

/** net + tax, at the line's scale. */
export function lineTotalOf(line: {
    quantity?: unknown;
    unitPrice?: unknown;
    taxRate?: unknown;
    taxAmount?: unknown;
}): number {
    const net = netOf(line.quantity, line.unitPrice);
    return roundTo(net + taxOf(net, line.taxRate, line.taxAmount), LINE_SCALE);
}

/** The order total the lines add up to: summed at line scale, rounded once. */
export function orderTotalOf(
    lines: ReadonlyArray<{ quantity?: unknown; unitPrice?: unknown; taxRate?: unknown; taxAmount?: unknown }>,
): number {
    return roundTo(lines.reduce((sum, line) => sum + lineTotalOf(line), 0), ORDER_SCALE);
}
