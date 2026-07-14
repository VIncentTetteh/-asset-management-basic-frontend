"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Calculator, ArrowRight, DollarSign, Search } from "lucide-react";
import { exchangeRateService, type ExchangeRateDto } from "@/services/exchangeRateService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "ZAR", "KES", "XOF"];

type FormData = Omit<ExchangeRateDto, "id" | "organisationId">;

export default function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const ratesKey = qk.module("exchange-rates");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ratesKey.list(),
    queryFn: () => exchangeRateService.listAll(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ratesKey.all });

  const createRate = useMutation({
    mutationFn: (data: FormData) => exchangeRateService.create({ ...data, rate: Number(data.rate) }),
    onSuccess: () => {
      toast.success("Exchange rate added");
      invalidate();
    },
    onError: () => toast.error("Failed to add exchange rate"),
  });
  const deleteRate = useMutation({
    mutationFn: (id: string) => exchangeRateService.delete(id),
    onSuccess: () => {
      toast.success("Exchange rate deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete rate"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Converter
  const [convAmount, setConvAmount] = useState("100");
  const [convFrom, setConvFrom] = useState("USD");
  const [convTo, setConvTo] = useState("GHS");
  const [convResult, setConvResult] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset({
      baseCurrency: "USD",
      targetCurrency: "GHS",
      rate: 0,
      effectiveDate: new Date().toISOString().split("T")[0],
      source: "",
    });
  }, [isModalOpen, reset]);

  const filtered = useMemo(() => {
    if (!searchTerm) return rates;
    const q = searchTerm.toUpperCase();
    return rates.filter(
      (r) => (r.baseCurrency || "").includes(q) || (r.targetCurrency || "").includes(q),
    );
  }, [rates, searchTerm]);

  const onSubmit = async (data: FormData) => {
    await createRate.mutateAsync(data);
    setIsModalOpen(false);
  };

  const handleDelete = async (rate: ExchangeRateDto) => {
    if (!(await confirm({ message: "Delete this exchange rate entry?", variant: "danger" }))) return;
    deleteRate.mutate(rate.id!);
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

  const columns = useMemo<ColumnDef<ExchangeRateDto, unknown>[]>(
    () => [
      {
        id: "pair",
        header: "Currency pair",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="data-mono inline-flex items-center gap-1.5 font-semibold text-foreground">
            {row.original.baseCurrency}
            <ArrowRight className="h-3 w-3 text-faint-fg" />
            {row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: "rate",
        header: () => <span className="block text-right">Rate</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right font-semibold">{Number(row.original.rate).toFixed(4)}</span>
        ),
      },
      {
        accessorKey: "effectiveDate",
        header: "Effective",
        cell: ({ row }) => (
          <span className="text-muted-fg">
            {row.original.effectiveDate ? new Date(row.original.effectiveDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <span className="text-muted-fg">{row.original.source || "Manual"}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete rate"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ListPageTemplate
      title="Exchange rates"
      subtitle={isLoading ? "Loading rates…" : `${rates.length} rate entries drive multi-currency reporting`}
      actions={
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add rate
        </Button>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Filter by currency…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Converter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-brand" />
              Currency converter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-end gap-3 sm:flex-row">
              <div className="w-full flex-1 space-y-1.5">
                <Label htmlFor="conv-amount">Amount</Label>
                <Input
                  id="conv-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={convAmount}
                  onChange={(e) => {
                    setConvAmount(e.target.value);
                    setConvResult(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-from">From</Label>
                <Select
                  id="conv-from"
                  value={convFrom}
                  onChange={(e) => {
                    setConvFrom(e.target.value);
                    setConvResult(null);
                  }}
                  className="w-28"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <ArrowRight className="mb-2.5 hidden h-4 w-4 shrink-0 text-faint-fg sm:block" />
              <div className="space-y-1.5">
                <Label htmlFor="conv-to">To</Label>
                <Select
                  id="conv-to"
                  value={convTo}
                  onChange={(e) => {
                    setConvTo(e.target.value);
                    setConvResult(null);
                  }}
                  className="w-28"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <Button onClick={handleConvert} isLoading={isConverting}>Convert</Button>
              {convResult !== null && (
                <div className="data-mono pb-1.5 text-lg font-bold text-brand">
                  {convResult.toLocaleString(undefined, { maximumFractionDigits: 2 })} {convTo}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyTitle="No exchange rates"
          emptyDescription="Add rates so asset values and reports can convert between currencies."
          emptyAction={
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <DollarSign className="mr-1.5 h-4 w-4" /> Add rate
            </Button>
          }
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add exchange rate"
        description="Rates are point-in-time entries; the newest effective date wins."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate-base">Base currency</Label>
              <Select id="rate-base" {...register("baseCurrency", { required: true })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-target">Target currency</Label>
              <Select id="rate-target" {...register("targetCurrency", { required: true })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate-value">Rate <span className="text-danger">*</span></Label>
              <Input id="rate-value" type="number" step="0.0001" min="0" {...register("rate", { required: true, min: 0 })} />
              {errors.rate && <p className="text-sm text-danger">Rate is required</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-date">Effective date</Label>
              <Input id="rate-date" type="date" {...register("effectiveDate", { required: true })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-source">Source</Label>
            <Input id="rate-source" placeholder="e.g. Bank of Ghana mid-rate" {...register("source")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createRate.isPending}>Add rate</Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
