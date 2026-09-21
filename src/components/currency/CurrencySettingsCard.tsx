"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrency } from "@/contexts/CurrencyContext";
import { currencyService } from "@/services/currencyService";
import { currencyName, isoCurrencyCodes } from "@/lib/currency";
import { extractErrorMessage } from "@/lib/error";

/**
 * Organisation base (reporting) currency. Everyone sees it; only org admins
 * (settings.canEdit) can change it. Changing it re-bases reported totals —
 * records keep their own currency.
 */
export function CurrencySettingsCard() {
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const { baseCurrency, availableCurrencies, canEditBaseCurrency, settingsLoading, settingsError } = useCurrency();
    const [selected, setSelected] = useState<string | null>(null);
    const target = selected ?? baseCurrency;
    const options = useMemo(() => isoCurrencyCodes(availableCurrencies), [availableCurrencies]);

    const update = useMutation({
        mutationFn: (code: string) => currencyService.updateSettings(code),
        onSuccess: (settings) => {
            toast.success(`Base currency changed to ${settings.baseCurrency}`);
            setSelected(null);
            // Every money aggregate in the app is reported in the base currency.
            void queryClient.invalidateQueries();
        },
        onError: (error) => toast.error(extractErrorMessage(error, "Failed to change the base currency")),
    });

    const onSave = async () => {
        if (target === baseCurrency) return;
        const hasRates = availableCurrencies.includes(target);
        const ok = await confirm({
            title: `Change base currency to ${target}?`,
            message:
                `Existing records keep the currency they were entered in. Dashboards, analytics and budget totals ` +
                `will be reported in ${target}, converted using your exchange rates. Any amount in a currency ` +
                `without a rate to ${target} is excluded from totals (and flagged) until you add that rate.` +
                (hasRates ? "" : ` There are currently no exchange rates involving ${target}.`),
            confirmLabel: `Use ${target}`,
            variant: "warning",
        });
        if (ok) update.mutate(target);
    };

    return (
        <Card className="mb-4">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Coins className="h-4 w-4 text-brand" /> Currency
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {settingsError ? (
                    <p className="text-sm text-danger">Currency settings could not be loaded.</p>
                ) : (
                    <p className="text-sm text-muted-fg">
                        Base currency:{" "}
                        <span className="data-mono font-semibold text-foreground">
                            {settingsLoading ? "…" : `${baseCurrency} · ${currencyName(baseCurrency)}`}
                        </span>
                        . Reports and totals are shown in this currency. Convertible currencies:{" "}
                        <span className="data-mono">{availableCurrencies.join(", ")}</span>.
                    </p>
                )}

                {canEditBaseCurrency ? (
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="w-56 space-y-1.5">
                            <Label htmlFor="org-base-currency">Change base currency</Label>
                            <Select
                                id="org-base-currency"
                                value={target}
                                onChange={(e) => setSelected(e.target.value)}
                                disabled={update.isPending}
                            >
                                {options.map((code) => (
                                    <option key={code} value={code}>
                                        {code} · {currencyName(code)}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <Button onClick={onSave} disabled={target === baseCurrency} isLoading={update.isPending}>
                            Save base currency
                        </Button>
                    </div>
                ) : null}

                <p className="text-xs text-faint-fg">
                    Amounts in currencies without an exchange rate are excluded from totals.{" "}
                    <Link href="/exchange-rates" className="font-semibold text-brand hover:underline">
                        Manage exchange rates
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
