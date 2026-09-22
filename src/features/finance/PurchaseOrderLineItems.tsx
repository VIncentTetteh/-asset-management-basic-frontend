"use client";

import { useFieldArray, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { lineTotalOf, orderTotalOf } from "@/features/finance/lineTotals";
import type { PurchaseOrderForm } from "@/features/finance/payloads";

const L = FIELD_LIMITS.poLineItem;

/** The shape a fresh row starts in — every field present so RHF registers them all. */
export const EMPTY_PO_LINE = {
    description: "",
    supplierPartNumber: "",
    categoryId: "",
    quantity: "",
    unitPrice: "",
    taxRate: "",
} as const;

interface Props {
    control: Control<PurchaseOrderForm>;
    register: UseFormRegister<PurchaseOrderForm>;
    /** Server and rule errors for the array, as react-hook-form reports them. */
    errors?: Record<string, { message?: unknown } | undefined>[];
    /** Optional asset categories to book a line against. */
    categories: ReadonlyArray<{ id?: string; name: string }>;
    /** Renders money in the order's currency. */
    formatMoney: (amount: number) => string;
    /** Disabled once the order has left DRAFT — the server refuses the edit anyway. */
    disabled?: boolean;
}

/**
 * The itemised lines of a purchase order.
 *
 * <p>An order may still be a single lump sum, so there is no minimum: with no
 * rows the typed total stands. As soon as one line exists the order total is the
 * sum of the lines and the total field stops being editable, because the server
 * derives it — showing an editable field whose value is discarded is worse than
 * showing none.
 */
export function PurchaseOrderLineItems({
    control,
    register,
    errors,
    categories,
    formatMoney,
    disabled = false,
}: Props) {
    const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
    // Watched rather than read from `fields`: useFieldArray's snapshot does not
    // change as the user types, so the running totals would sit still.
    const watched = useWatch({ control, name: "lineItems" }) ?? [];
    const orderTotal = orderTotalOf(watched);

    return (
        <section className="space-y-2 rounded-md border border-edge-subtle p-3" data-testid="po-line-items">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-[13px] font-semibold leading-none text-foreground">Line items</h3>
                    <p className="mt-1 text-xs text-faint-fg">
                        Optional. With lines, the order total is their sum.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => append({ ...EMPTY_PO_LINE })}
                    data-testid="po-add-line"
                >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
                </Button>
            </div>

            {fields.length === 0 ? (
                <p className="py-2 text-sm text-muted-fg">
                    No lines — this order is a single lump sum.
                </p>
            ) : null}

            <ol className="space-y-3">
                {fields.map((field, index) => {
                    const rowErrors = errors?.[index];
                    const row = watched[index] ?? {};
                    return (
                        <li key={field.id} className="space-y-2 rounded-md bg-surface-subtle p-2" data-testid="po-line-row">
                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-12 space-y-1 sm:col-span-5">
                                    <Label htmlFor={`po-line-${index}-description`} className="text-xs">
                                        Description <span className="text-danger">*</span>
                                    </Label>
                                    <Input
                                        id={`po-line-${index}-description`}
                                        placeholder="Dell Latitude 5450"
                                        disabled={disabled}
                                        {...limitInputProps(L.description)}
                                        {...register(`lineItems.${index}.description`, limitRules<PurchaseOrderForm, `lineItems.${number}.description`>(L.description, "Description"))}
                                    />
                                    <FieldError error={rowErrors?.description} />
                                </div>
                                <div className="col-span-6 space-y-1 sm:col-span-3">
                                    <Label htmlFor={`po-line-${index}-part`} className="text-xs">Supplier part no.</Label>
                                    <Input
                                        id={`po-line-${index}-part`}
                                        className="data-mono"
                                        disabled={disabled}
                                        {...limitInputProps(L.supplierPartNumber)}
                                        {...register(`lineItems.${index}.supplierPartNumber`,
                                            limitRules<PurchaseOrderForm, `lineItems.${number}.supplierPartNumber`>(L.supplierPartNumber, "Supplier part number"))}
                                    />
                                    <FieldError error={rowErrors?.supplierPartNumber} />
                                </div>
                                <div className="col-span-6 space-y-1 sm:col-span-4">
                                    <Label htmlFor={`po-line-${index}-category`} className="text-xs">Category</Label>
                                    <Select
                                        id={`po-line-${index}-category`}
                                        disabled={disabled}
                                        {...register(`lineItems.${index}.categoryId`)}
                                    >
                                        <option value="">No category</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>{category.name}</option>
                                        ))}
                                    </Select>
                                    <FieldError error={rowErrors?.categoryId} />
                                </div>
                            </div>

                            <div className="grid grid-cols-12 items-end gap-2">
                                <div className="col-span-4 space-y-1 sm:col-span-3">
                                    <Label htmlFor={`po-line-${index}-quantity`} className="text-xs">
                                        Quantity <span className="text-danger">*</span>
                                    </Label>
                                    <Input
                                        id={`po-line-${index}-quantity`}
                                        type="number"
                                        disabled={disabled}
                                        {...limitInputProps(L.quantity)}
                                        {...register(`lineItems.${index}.quantity`, limitRules<PurchaseOrderForm, `lineItems.${number}.quantity`>(L.quantity, "Quantity"))}
                                    />
                                    <FieldError error={rowErrors?.quantity} />
                                </div>
                                <div className="col-span-4 space-y-1 sm:col-span-3">
                                    <Label htmlFor={`po-line-${index}-price`} className="text-xs">
                                        Unit price <span className="text-danger">*</span>
                                    </Label>
                                    <Input
                                        id={`po-line-${index}-price`}
                                        type="number"
                                        disabled={disabled}
                                        {...limitInputProps(L.unitPrice)}
                                        {...register(`lineItems.${index}.unitPrice`, limitRules<PurchaseOrderForm, `lineItems.${number}.unitPrice`>(L.unitPrice, "Unit price"))}
                                    />
                                    <FieldError error={rowErrors?.unitPrice} />
                                </div>
                                <div className="col-span-4 space-y-1 sm:col-span-2">
                                    <Label htmlFor={`po-line-${index}-tax`} className="text-xs">Tax %</Label>
                                    <Input
                                        id={`po-line-${index}-tax`}
                                        type="number"
                                        disabled={disabled}
                                        {...limitInputProps(L.taxRate)}
                                        {...register(`lineItems.${index}.taxRate`, limitRules<PurchaseOrderForm, `lineItems.${number}.taxRate`>(L.taxRate, "Tax rate"))}
                                    />
                                    <FieldError error={rowErrors?.taxRate} />
                                </div>
                                <div className="col-span-8 space-y-1 sm:col-span-3">
                                    <span className="block text-xs text-muted-fg">Line total</span>
                                    <output
                                        className="data-mono block py-2 text-sm font-semibold"
                                        data-testid={`po-line-total-${index}`}
                                    >
                                        {formatMoney(lineTotalOf(row))}
                                    </output>
                                </div>
                                <div className="col-span-4 flex justify-end sm:col-span-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-danger"
                                        disabled={disabled}
                                        aria-label={`Remove line ${index + 1}`}
                                        data-testid={`po-remove-line-${index}`}
                                        onClick={() => remove(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {fields.length > 0 ? (
                <p className="flex justify-between border-t border-edge-subtle pt-2 text-sm">
                    <span className="text-muted-fg">Order total from lines</span>
                    <span className="data-mono font-semibold" data-testid="po-lines-total">{formatMoney(orderTotal)}</span>
                </p>
            ) : null}
        </section>
    );
}
