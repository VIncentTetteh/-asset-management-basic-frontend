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
    onError: () => toast.error("Failed to save review"),
  });
  const deleteReview = useMutation({
    mutationFn: (id: string) => vendorReviewService.delete(id),
    onSuccess: () => {
      toast.success("Review deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete review"),
  });

  const { register, handleSubmit, reset } = useForm<VendorReviewDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editingReview
        ? {
            supplierId: editingReview.supplierId,
            rating: Number(editingReview.rating),
            qualityScore: editingReview.qualityScore ?? undefined,
            deliveryScore: editingReview.deliveryScore ?? undefined,
            supportScore: editingReview.supportScore ?? undefined,
            feedback: editingReview.feedback ?? "",
            periodStart: editingReview.periodStart ?? "",
            periodEnd: editingReview.periodEnd ?? "",
          }
        : {
            supplierId: selectedSupplierId || "",
            rating: 0,
            qualityScore: 0,
            deliveryScore: 0,
            supportScore: 0,
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

  const onSubmit = async (data: VendorReviewDto) => {
    const avg = parseFloat(
      ([data.qualityScore, data.deliveryScore, data.supportScore].map(Number).reduce((a, b) => a + b, 0) / 3).toFixed(2),
    );
    const payload: VendorReviewDto = {
      ...data,
      rating: Number(data.rating) || avg,
      qualityScore: Number(data.qualityScore),
      deliveryScore: Number(data.deliveryScore),
      supportScore: Number(data.supportScore),
      feedback: data.feedback?.trim() || undefined,
      periodStart: data.periodStart || undefined,
      periodEnd: data.periodEnd || undefined,
    };
    await saveReview.mutateAsync({ id: editingReview?.id, data: payload });
    setIsModalOpen(false);
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
            {row.original.periodStart ? new Date(row.original.periodStart).toLocaleDateString() : "—"}
            {" – "}
            {row.original.periodEnd ? new Date(row.original.periodEnd).toLocaleDateString() : "—"}
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
        description="Overall rating defaults to the average of the three scores."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("rating", { valueAsNumber: true })} />
          <div className="space-y-2">
            <Label htmlFor="vr-supplier">Supplier <span className="text-danger">*</span></Label>
            <Select id="vr-supplier" {...register("supplierId", { required: true })} disabled={!!editingReview}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(["qualityScore", "deliveryScore", "supportScore"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`vr-${field}`}>
                  {field === "qualityScore" ? "Quality" : field === "deliveryScore" ? "Delivery" : "Support"} (0–5)
                </Label>
                <Input id={`vr-${field}`} type="number" min="0" max="5" step="0.5" {...register(field)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vr-start">Period start <span className="text-danger">*</span></Label>
              <Input id="vr-start" type="date" {...register("periodStart", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vr-end">Period end <span className="text-danger">*</span></Label>
              <Input id="vr-end" type="date" {...register("periodEnd", { required: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vr-feedback">Feedback</Label>
            <Textarea id="vr-feedback" placeholder="Delivery delays in Q2; strong support response…" {...register("feedback")} />
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
