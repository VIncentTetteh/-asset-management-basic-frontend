"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import type { VendorReview, VendorReviewDto } from "@/types";
import { vendorReviewService } from "@/services/vendorReviewService";
import { supplierService } from "@/services/supplierService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/local-date";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { FieldError } from "@/components/ui/field-error";
import { reportApiError, reportFormErrors } from "@/lib/api-validation";
import { buildVendorReviewPayload, vendorReviewRating, type VendorReviewForm } from "@/features/finance/payloads";

const SCORE_FIELDS = ["qualityScore", "deliveryScore", "supportScore"] as const;
const SCORE_LABEL: Record<(typeof SCORE_FIELDS)[number], string> = {
  qualityScore: "Quality",
  deliveryScore: "Delivery",
  supportScore: "Support",
};

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 4 ? "text-[var(--status-in-use)]" : score >= 3 ? "text-[var(--status-maintenance)]" : "text-danger";
  return (
    <span className={cn("data-mono inline-flex items-center gap-1 text-sm font-bold", tone)}>
      <Star className="h-3.5 w-3.5 fill-current" />
      {Number.isFinite(score) ? score.toFixed(1) : "—"}
    </span>
  );
}

export default function VendorReviewsPage() {
  const queryClient = useQueryClient();
  const reviewsKey = qk.module("vendor-reviews");
  const { confirm, ConfirmDialog } = useConfirm();

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<VendorReview | null>(null);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: [...reviewsKey.list(), selectedSupplierId],
    queryFn: () => vendorReviewService.getAll(selectedSupplierId || undefined),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: qk.module("suppliers").list(),
    queryFn: () => supplierService.getAll(),
    staleTime: 300_000,
  });
  const { data: summary } = useQuery({
    queryKey: [...reviewsKey.all, "summary", selectedSupplierId],
    queryFn: () => vendorReviewService.getSupplierSummary(selectedSupplierId),
    enabled: !!selectedSupplierId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: reviewsKey.all });

  const saveReview = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: VendorReviewDto }) =>
      id ? vendorReviewService.update(id, data) : vendorReviewService.create(data),
    onSuccess: (_res, vars) => {
      toast.success(vars.id ? "Review updated" : "Review added");
      invalidate();
    },
  });
  const deleteReview = useMutation({
    mutationFn: (id: string) => vendorReviewService.delete(id),
    onSuccess: () => {
      toast.success("Review deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete review"),
  });

  const { register, handleSubmit, reset, watch, setError, formState: { errors } } = useForm<VendorReviewForm>();
  const previewRating = vendorReviewRating(
    SCORE_FIELDS.map((f) => {
      const v = watch(f);
      return v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
    }),
  );

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingReview
        ? {
            supplierId: editingReview.supplierId,
            qualityScore: editingReview.qualityScore ?? undefined,
            deliveryScore: editingReview.deliveryScore ?? undefined,
            supportScore: editingReview.supportScore ?? undefined,
            feedback: editingReview.feedback ?? "",
            periodStart: editingReview.periodStart ?? "",
            periodEnd: editingReview.periodEnd ?? "",
          }
        : {
            supplierId: selectedSupplierId || "",
            qualityScore: "",
            deliveryScore: "",
            supportScore: "",
            feedback: "",
            periodStart: "",
            periodEnd: "",
          },
    );
  }, [isModalOpen, editingReview, selectedSupplierId, reset]);

  const supplierName = useMemo(() => {
    const map = new Map(suppliers.map((s) => [s.id, s.name]));
    return (id?: string) => map.get(id ?? "") ?? "—";
  }, [suppliers]);

  const openCreate = () => {
    setEditingReview(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (review: VendorReview) => {
    if (!(await confirm({ message: "Delete this review?", variant: "danger" }))) return;
    deleteReview.mutate(review.id);
  };

  const onSubmit = async (data: VendorReviewForm) => {
    const payload: VendorReviewDto = buildVendorReviewPayload({
      ...data,
      // RHF drops the disabled supplier select on edit; the API keeps it anyway.
      supplierId: data.supplierId || editingReview?.supplierId,
    });
    try {
      await saveReview.mutateAsync({ id: editingReview?.id, data: payload });
      setIsModalOpen(false);
    } catch (error) {
      reportApiError(error, { fallback: "Failed to save review", setError });
    }
  };

  const columns = useMemo<ColumnDef<VendorReview, unknown>[]>(
    () => [
      {
        id: "supplier",
        header: "Supplier",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">{supplierName(row.original.supplierId)}</span>
        ),
      },
      {
        accessorKey: "rating",
        header: "Overall",
        cell: ({ row }) => <ScoreBadge score={Number(row.original.rating)} />,
      },
      {
        id: "scores",
        header: "Quality / Delivery / Support",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="data-mono text-xs text-muted-fg">
            {[row.original.qualityScore, row.original.deliveryScore, row.original.supportScore]
              .map((s) => (s == null ? "—" : Number(s).toFixed(1)))
              .join(" / ")}
          </span>
        ),
      },
      {
        id: "period",
        header: "Period",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-fg">
            {formatLocalDate(row.original.periodStart)}
            {" – "}
            {formatLocalDate(row.original.periodEnd)}
          </span>
        ),
      },
      {
        id: "feedback",
        header: "Feedback",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate text-muted-fg" title={row.original.feedback ?? undefined}>
            {row.original.feedback || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit review"
              onClick={() => {
                setEditingReview(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete review"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplierName],
  );

  return (
    <ListPageTemplate
      title="Vendor reviews"
      subtitle={isLoading ? "Loading reviews…" : `${reviews.length} performance reviews`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add review
        </Button>
      }
      toolbar={
        <Select
          value={selectedSupplierId}
          onChange={(e) => setSelectedSupplierId(e.target.value)}
          className="w-64"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      }
    >
      <div className="space-y-4">
        {summary && selectedSupplierId ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Performance summary — {summary.supplierName || supplierName(summary.supplierId)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-8">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Average rating</p>
                  <ScoreBadge score={Number(summary.averageRating)} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Total reviews</p>
                  <p className="data-mono text-sm font-bold text-foreground">{summary.totalReviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <DataTable
          columns={columns}
          data={reviews}
          isLoading={isLoading}
          emptyTitle="No reviews yet"
          emptyDescription="Score suppliers on quality, delivery, and support to build a performance record."
          emptyAction={
            <Button size="sm" onClick={openCreate}>
              <Star className="mr-1.5 h-4 w-4" /> Add review
            </Button>
          }
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReview ? "Edit review" : "Add review"}
        description="The overall rating is the average of the three scores."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vr-supplier">Supplier <span className="text-danger">*</span></Label>
            <Select id="vr-supplier" {...register("supplierId", { required: editingReview ? false : "Supplier is required" })} disabled={!!editingReview}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <FieldError error={errors.supplierId} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {SCORE_FIELDS.map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`vr-${field}`}>
                  {SCORE_LABEL[field]} (1–5) <span className="text-danger">*</span>
                </Label>
                <Input
                  id={`vr-${field}`}
                  type="number"
                  {...limitInputProps(FIELD_LIMITS.vendorReview[field])}
                  {...register(field, {
                    ...limitRules<VendorReviewForm, typeof field>(FIELD_LIMITS.vendorReview[field], SCORE_LABEL[field]),
                    required: `${SCORE_LABEL[field]} score is required`,
                    validate: (v) => Number.isInteger(Number(v)) || "Use a whole number from 1 to 5",
                  })}
                />
                <FieldError error={errors[field]} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-fg">
            Overall rating: <span className="data-mono font-semibold text-foreground">{previewRating?.toFixed(2) ?? "—"}</span>
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vr-start">Period start <span className="text-danger">*</span></Label>
              <Input id="vr-start" type="date" {...register("periodStart", limitRules<VendorReviewForm, "periodStart">(FIELD_LIMITS.vendorReview.periodStart, "Period start"))} />
              <FieldError error={errors.periodStart} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vr-end">Period end <span className="text-danger">*</span></Label>
              <Input
                id="vr-end"
                type="date"
                {...register("periodEnd", {
                  ...limitRules<VendorReviewForm, "periodEnd">(FIELD_LIMITS.vendorReview.periodEnd, "Period end"),
                  validate: (end, values) =>
                    !end || !values.periodStart || String(end) >= String(values.periodStart) || "Period end must be on or after the start",
                })}
              />
              <FieldError error={errors.periodEnd} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vr-feedback">Feedback</Label>
            <Textarea id="vr-feedback" placeholder="Delivery delays in Q2; strong support response…" {...register("feedback")} />
            <FieldError error={errors.feedback} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={saveReview.isPending}>
              {editingReview ? "Save changes" : "Add review"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
