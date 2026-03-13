"use client";

import { useState, useEffect } from "react";
import { VendorReview, VendorReviewDto, VendorReviewSummary, Supplier } from "@/types";
import { vendorReviewService } from "@/services/vendorReviewService";
import { supplierService } from "@/services/supplierService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { useForm } from "react-hook-form";

const ScoreBadge = ({ score }: { score: number }) => {
    const color = score >= 4 ? "text-emerald-600 bg-emerald-50" : score >= 3 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
            <Star className="h-3 w-3 fill-current" />
            {score.toFixed(1)}
        </span>
    );
};

export default function VendorReviewsPage() {
    const [reviews, setReviews] = useState<VendorReview[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
    const [summary, setSummary] = useState<VendorReviewSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReview, setEditingReview] = useState<VendorReview | null>(null);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<VendorReviewDto>();

    const q = watch("qualityScore");
    const d = watch("deliveryScore");
    const s = watch("supportScore");

    useEffect(() => {
        const vals = [q, d, s].map(Number).filter(v => !isNaN(v) && v > 0);
        if (vals.length === 3) {
            setValue("rating", parseFloat((vals.reduce((a, b) => a + b, 0) / 3).toFixed(2)));
        }
    }, [q, d, s, setValue]);

    const fetchAll = async (supplierId?: string) => {
        try {
            setIsLoading(true);
            const [reviewsData, suppliersData] = await Promise.allSettled([
                vendorReviewService.getAll(supplierId),
                supplierService.getAll(),
            ]);
            if (reviewsData.status === "fulfilled") setReviews(reviewsData.value);
            if (suppliersData.status === "fulfilled") setSuppliers(suppliersData.value);

            if (supplierId) {
                try {
                    const s = await vendorReviewService.getSupplierSummary(supplierId);
                    setSummary(s);
                } catch { setSummary(null); }
            } else {
                setSummary(null);
            }
        } catch {
            toast.error("Failed to load reviews");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleFilterChange = (supplierId: string) => {
        setSelectedSupplierId(supplierId);
        fetchAll(supplierId || undefined);
    };

    const handleOpenCreate = () => {
        setEditingReview(null);
        reset({ supplierId: selectedSupplierId || "", reviewPeriod: "", rating: 0, qualityScore: 0, deliveryScore: 0, supportScore: 0, reviewDate: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (review: VendorReview) => {
        setEditingReview(review);
        reset({
            supplierId: review.supplierId,
            reviewPeriod: "",
            rating: review.rating,
            qualityScore: review.qualityScore ?? undefined,
            deliveryScore: review.deliveryScore ?? undefined,
            supportScore: review.supportScore ?? undefined,
            reviewDate: "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this review?")) return;
        try {
            await vendorReviewService.delete(id);
            toast.success("Review deleted");
            fetchAll(selectedSupplierId || undefined);
        } catch {
            toast.error("Failed to delete review");
        }
    };

    const onSubmit = async (data: VendorReviewDto) => {
        const avg = parseFloat(([data.qualityScore, data.deliveryScore, data.supportScore].map(Number).reduce((a, b) => a + b, 0) / 3).toFixed(2));
        const payload = {
            ...data,
            rating: Number(data.rating) || avg,
            qualityScore: Number(data.qualityScore),
            deliveryScore: Number(data.deliveryScore),
            supportScore: Number(data.supportScore),
            overallScore: Number(data.overallScore) || avg,
        };
        try {
            if (editingReview) {
                await vendorReviewService.update(editingReview.id, payload);
                toast.success("Review updated");
            } else {
                await vendorReviewService.create(payload);
                toast.success("Review added");
            }
            setIsModalOpen(false);
            fetchAll(selectedSupplierId || undefined);
        } catch {
            toast.error("Failed to save review");
        }
    };

    const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name || id;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendor Reviews</h1>
                    <p className="text-slate-500">Track and review supplier performance.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Review
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="w-72">
                    <Select value={selectedSupplierId} onChange={e => handleFilterChange(e.target.value)}>
                        <option value="">All Suppliers</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                </div>
            </div>

            {summary && (
                <Card className="border-purple-200 bg-purple-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-slate-700">
                            Performance Summary — {summary.supplierName || supplierName(summary.supplierId)}
                        </CardTitle>
                        <p className="text-xs text-slate-500">{summary.totalReviews} review{summary.totalReviews !== 1 ? "s" : ""}</p>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-center">
                            {[
                                { label: "Quality", value: summary.avgQualityScore },
                                { label: "Delivery", value: summary.avgDeliveryScore },
                                { label: "Support", value: summary.avgSupportScore },
                                { label: "Overall", value: summary.avgOverallScore },
                            ].map(item => (
                                <div key={item.label}>
                                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                                    <ScoreBadge score={item.value} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-slate-200">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Star className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No reviews found</h3>
                            <p className="text-slate-500 mt-1">Add supplier performance reviews to track vendor quality.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Supplier</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Quality</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Delivery</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Support</th>
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Overall</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviews.map((r) => (
                                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-4 font-medium text-slate-900">{r.supplierName || supplierName(r.supplierId)}</td>
                                            <td className="py-3 px-4">{r.qualityScore != null ? <ScoreBadge score={r.qualityScore} /> : "—"}</td>
                                            <td className="py-3 px-4">{r.deliveryScore != null ? <ScoreBadge score={r.deliveryScore} /> : "—"}</td>
                                            <td className="py-3 px-4">{r.supportScore != null ? <ScoreBadge score={r.supportScore} /> : "—"}</td>
                                            <td className="py-3 px-4"><ScoreBadge score={r.rating} /></td>
                                            <td className="py-3 px-4">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(r)} className="h-7 px-2">
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="h-7 px-2 text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingReview ? "Edit Review" : "Add Vendor Review"}
                description="Rate supplier performance across key dimensions."
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <input type="hidden" {...register("rating", { valueAsNumber: true })} />
                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier <span className="text-red-500">*</span></Label>
                        <Select id="supplierId" {...register("supplierId", { required: "Supplier is required" })}>
                            <option value="">— Select Supplier —</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        {errors.supplierId && <p className="text-sm text-red-500">{errors.supplierId.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="reviewPeriod">Review Period <span className="text-red-500">*</span></Label>
                            <Input id="reviewPeriod" placeholder="e.g. Q1-2025" {...register("reviewPeriod", { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reviewDate">Review Date <span className="text-red-500">*</span></Label>
                            <Input id="reviewDate" type="date" {...register("reviewDate", { required: true })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: "qualityScore", label: "Quality Score" },
                            { id: "deliveryScore", label: "Delivery Score" },
                            { id: "supportScore", label: "Support Score" },
                        ].map(field => (
                            <div key={field.id} className="space-y-2">
                                <Label htmlFor={field.id}>{field.label} <span className="text-xs text-slate-400">(0–5)</span></Label>
                                <Input
                                    id={field.id}
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="5"
                                    {...register(field.id as keyof VendorReviewDto, { valueAsNumber: true, required: true })}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="overallScore">Overall Score <span className="text-xs text-slate-400">(auto-calculated)</span></Label>
                        <Input id="overallScore" type="number" step="0.01" min="0" max="5" {...register("overallScore", { valueAsNumber: true })} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="comments">Comments</Label>
                        <textarea
                            id="comments"
                            rows={3}
                            placeholder="Optional notes..."
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            {...register("comments")}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {editingReview ? "Save Changes" : "Add Review"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
