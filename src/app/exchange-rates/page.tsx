"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
    ArrowRightLeft, Plus, Trash2, RefreshCw, Search, Loader2, Calculator, DollarSign,
} from "lucide-react";

import { exchangeRateService, ExchangeRateDto } from "@/services/exchangeRateService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";

// ── Constants ──────────────────────────────────────────────────────────────────

const CURRENCIES = ["USD", "GHS", "EUR", "GBP", "NGN", "KES", "ZAR", "CAD", "AUD", "JPY", "CNY", "INR"];

const fmt = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ── Component ──────────────────────────────────────────────────────────────────

type FormData = Omit<ExchangeRateDto, "id" | "organisationId">;

export default function ExchangeRatesPage() {
    const [rates, setRates] = useState<ExchangeRateDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Converter state
    const [convAmount, setConvAmount] = useState<string>("100");
    const [convFrom, setConvFrom] = useState("USD");
    const [convTo, setConvTo] = useState("GHS");
    const [convResult, setConvResult] = useState<number | null>(null);
    const [isConverting, setIsConverting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const data = await exchangeRateService.listAll();
            setRates(data);
        } catch {
            toast.error("Failed to load exchange rates");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const filtered = useMemo(() => {
        if (!searchTerm) return rates;
        const q = searchTerm.toUpperCase();
        return rates.filter(r =>
            (r.baseCurrency || "").includes(q) ||
            (r.targetCurrency || "").includes(q)
        );
    }, [rates, searchTerm]);

    const openCreate = () => {
        reset({
            baseCurrency: "USD",
            targetCurrency: "GHS",
            rate: 0,
            effectiveDate: new Date().toISOString().split("T")[0],
            source: "",
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        try {
            await exchangeRateService.create({
                ...data,
                rate: Number(data.rate),
            });
            toast.success("Exchange rate added");
            setIsModalOpen(false);
            fetchAll();
        } catch {
            toast.error("Failed to add exchange rate");
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Delete this exchange rate entry?", variant: "danger" })) return;
        try {
            await exchangeRateService.delete(id);
            toast.success("Exchange rate deleted");
            fetchAll();
        } catch {
            toast.error("Failed to delete rate");
        }
    };

    const handleConvert = async () => {
        const amount = parseFloat(convAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        setIsConverting(true);
        try {
            const result = await exchangeRateService.convert(amount, convFrom, convTo);
            setConvResult(result);
        } catch {
            toast.error("Conversion failed — no matching rate found");
            setConvResult(null);
        } finally {
            setIsConverting(false);
        }
    };

    if (isLoading) return <PageSpinner />;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Exchange Rates"
                subtitle="Manage currency exchange rates and convert amounts across currencies"
                actions={
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Rate
                    </Button>
                }
            />

            {/* Currency Converter */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-blue-600" />
                        Currency Converter
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1">
                            <Label htmlFor="conv-amount">Amount</Label>
                            <Input
                                id="conv-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={convAmount}
                                onChange={e => { setConvAmount(e.target.value); setConvResult(null); }}
                                className="bg-white"
                            />
                        </div>
                        <div>
                            <Label htmlFor="conv-from">From</Label>
                            <Select id="conv-from" value={convFrom} onChange={e => { setConvFrom(e.target.value); setConvResult(null); }} className="w-28 bg-white">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </div>
                        <div className="pb-1">
                            <ArrowRightLeft className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                            <Label htmlFor="conv-to">To</Label>
                            <Select id="conv-to" value={convTo} onChange={e => { setConvTo(e.target.value); setConvResult(null); }} className="w-28 bg-white">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </div>
                        <Button onClick={handleConvert} disabled={isConverting} className="gap-2">
                            {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                            Convert
                        </Button>
                    </div>
                    {convResult !== null && (
                        <div className="mt-4 rounded-lg bg-white border border-blue-100 p-4 flex items-center gap-3">
                            <DollarSign className="h-6 w-6 text-blue-600 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">Converted amount</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {convResult.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} <span className="text-base font-medium text-slate-500">{convTo}</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {convAmount} {convFrom} → {convResult.toFixed(4)} {convTo}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-5">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Search by currency code…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-900">
                        Exchange Rates
                        <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <ArrowRightLeft className="h-10 w-10 opacity-30" />
                            <p className="text-sm">No exchange rates defined yet</p>
                            <Button variant="outline" size="sm" onClick={openCreate} className="mt-2 gap-1">
                                <Plus className="h-3.5 w-3.5" /> Add First Rate
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Base Currency</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Target Currency</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Rate</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Effective Date</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Source</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(rate => (
                                        <tr key={rate.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm">
                                                    {rate.baseCurrency}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-sm">
                                                    {rate.targetCurrency}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="font-mono text-slate-900 font-medium">
                                                    {Number(rate.rate).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{fmt(rate.effectiveDate)}</td>
                                            <td className="py-3 px-4 text-slate-500 text-xs">{rate.source || "—"}</td>
                                            <td className="py-3 px-4">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                                    onClick={() => handleDelete(rate.id || "")}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Exchange Rate" description="Define a new currency exchange rate">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="r-base">Base Currency *</Label>
                            <Select id="r-base" {...register("baseCurrency", { required: "Required" })}>
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="r-target">Target Currency *</Label>
                            <Select id="r-target" {...register("targetCurrency", { required: "Required" })}>
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="r-rate">Rate (1 base = ? target) *</Label>
                        <Input id="r-rate" type="number" step="0.000001" min="0" placeholder="e.g. 15.5" {...register("rate", { required: "Rate is required", valueAsNumber: true, min: { value: 0.000001, message: "Rate must be positive" } })} />
                        {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="r-date">Effective Date</Label>
                        <Input id="r-date" type="date" {...register("effectiveDate")} />
                    </div>
                    <div>
                        <Label htmlFor="r-source">Source</Label>
                        <Input id="r-source" placeholder="e.g. ECB, XE.com, Manual" {...register("source")} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Add Rate
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                    </div>
                </form>
            </Modal>

            {ConfirmDialog}
        </div>
    );
}
