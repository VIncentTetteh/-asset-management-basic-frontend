"use client";

import { useState, useEffect, useMemo } from "react";
import { PCISAQRecord, PCISAQDto, ComplianceAnswer } from "@/types";
import { pciSaqService } from "@/services/complianceService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, CreditCard, ExternalLink, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";

const ANSWERS: ComplianceAnswer[] = ["YES", "NO", "NOT_APPLICABLE", "COMPENSATING_CONTROL"];

const answerColor: Record<ComplianceAnswer, string> = {
    YES: "bg-emerald-100 text-emerald-700 border-emerald-200",
    NO: "bg-red-100 text-red-700 border-red-200",
    NOT_APPLICABLE: "bg-slate-100 text-slate-600 border-slate-200",
    COMPENSATING_CONTROL: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function PCISAQPage() {
    const [items, setItems] = useState<PCISAQRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<PCISAQRecord | null>(null);
    const [search, setSearch] = useState("");
    const [answerFilter, setAnswerFilter] = useState("");

    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<PCISAQDto>();
    const complianceStatus = watch("complianceStatus");

    const fetchData = async () => {
        try {
            setIsLoading(true);
            setItems(await pciSaqService.getAll());
        } catch {
            toast.error("Failed to load PCI SAQ records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const stats = useMemo(() => ({
        yes: items.filter(i => i.complianceStatus === "YES").length,
        no: items.filter(i => i.complianceStatus === "NO").length,
        compensating: items.filter(i => i.complianceStatus === "COMPENSATING_CONTROL").length,
        na: items.filter(i => i.complianceStatus === "NOT_APPLICABLE").length,
    }), [items]);

    const filtered = useMemo(() => {
        const base = answerFilter ? items.filter(i => i.complianceStatus === answerFilter) : items;
        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(i =>
            i.requirementNumber.toLowerCase().includes(q) ||
            (i.requirementText ?? "").toLowerCase().includes(q) ||
            (i.notes ?? "").toLowerCase().includes(q)
        );
    }, [items, search, answerFilter]);

    const handleOpenCreate = () => {
        setEditing(null);
        reset({ requirementNumber: "", complianceStatus: "YES" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: PCISAQRecord) => {
        setEditing(item);
        reset({
            requirementNumber: item.requirementNumber,
            requirementText: item.requirementText ?? "",
            complianceStatus: item.complianceStatus ?? "YES",
            compensatingControl: item.compensatingControl ?? "",
            evidenceUrl: item.evidenceUrl ?? "",
            targetDate: item.targetDate ? item.targetDate.split("T")[0] : "",
            notes: item.notes ?? "",
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data: PCISAQDto) => {
        try {
            const normalized: PCISAQDto = {
                ...data,
                targetDate: data.targetDate
                    ? new Date(`${data.targetDate}T00:00:00Z`).toISOString()
                    : undefined,
            };
            const clean = Object.fromEntries(Object.entries(normalized).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as PCISAQDto;
            if (editing) {
                const editingNormalized: Partial<PCISAQDto> = {
                    ...(editing as unknown as Partial<PCISAQDto>),
                    targetDate: editing.targetDate ? new Date(editing.targetDate).toISOString() : undefined,
                };
                const patch = buildPatchPayload<PCISAQDto>(editingNormalized, clean);
                if (!Object.keys(patch).length) { toast("No changes"); return; }
                await pciSaqService.update(editing.id, patch);
                toast.success("Updated");
            } else {
                await pciSaqService.create(clean);
                toast.success("SAQ record created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch {
            toast.error("Failed to save");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">PCI-DSS SAQ</h1>
                    <p className="text-slate-500">Self-Assessment Questionnaire answers per PCI-DSS requirement.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="mr-2 h-4 w-4" /> Add SAQ Record
                </Button>
            </div>

            {!isLoading && items.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{stats.yes}</div>
                        <div className="text-xs text-emerald-600 font-semibold uppercase mt-1">Compliant</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-red-700">{stats.no}</div>
                        <div className="text-xs text-red-600 font-semibold uppercase mt-1">Non-Compliant</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700">{stats.compensating}</div>
                        <div className="text-xs text-amber-600 font-semibold uppercase mt-1">Compensating</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-slate-600">{stats.na}</div>
                        <div className="text-xs text-slate-500 font-semibold uppercase mt-1">N/A</div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by requirement number or text..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <select value={answerFilter} onChange={e => setAnswerFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700">
                    <option value="">All Answers</option>
                    {ANSWERS.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <CreditCard className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{search ? "No SAQ records match your search" : "No SAQ records found"}</h3>
                        <p className="text-slate-500 mt-1">Document your PCI-DSS Self-Assessment Questionnaire answers.</p>
                        {!search && <Button onClick={handleOpenCreate} className="mt-6 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">Add SAQ Record</Button>}
                    </div>
                ) : filtered.map(item => (
                    <Card key={item.id} className="group border-slate-200 hover:shadow-md transition-all flex flex-col">
                        <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="text-xs font-bold font-mono text-teal-700">Req {item.requirementNumber}</span>
                                    {item.requirementText && (
                                        <CardTitle className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2">{item.requirementText}</CardTitle>
                                    )}
                                </div>
                                {item.complianceStatus && (
                                    <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wide ${answerColor[item.complianceStatus]}`}>
                                        {item.complianceStatus.replace(/_/g, " ")}
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                            <div className="flex-1 space-y-2">
                                {item.compensatingControl && (
                                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 line-clamp-2 border border-amber-100">Compensating: {item.compensatingControl}</p>
                                )}
                                {item.evidenceUrl && (
                                    <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                                        <ExternalLink className="h-3 w-3" /> Evidence
                                    </a>
                                )}
                                {item.targetDate && <p className="text-xs text-slate-500">Target: <span className="font-medium">{new Date(item.targetDate).toLocaleDateString()}</span></p>}
                                {item.notes && <p className="text-xs text-slate-500 line-clamp-2">{item.notes}</p>}
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                title={editing ? "Edit SAQ Record" : "Add SAQ Record"}
                description="Record a PCI-DSS Self-Assessment Questionnaire answer.">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Requirement Number <span className="text-red-500">*</span></Label>
                            <Input {...register("requirementNumber", { required: true })} placeholder="1.1" />
                            {errors.requirementNumber && <p className="text-xs text-red-500">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Compliance Status</Label>
                            <Select {...register("complianceStatus")}>
                                {ANSWERS.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Requirement Text</Label>
                        <Textarea {...register("requirementText")} placeholder="Describe the PCI-DSS requirement..." />
                    </div>
                    {complianceStatus === "COMPENSATING_CONTROL" && (
                        <div className="space-y-1.5">
                            <Label>Compensating Control</Label>
                            <Textarea {...register("compensatingControl")} placeholder="Describe the compensating control..." />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>Evidence URL</Label>
                        <Input {...register("evidenceUrl")} placeholder="https://..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Target Date</Label>
                        <Input type="date" {...register("targetDate")} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea {...register("notes")} placeholder="Additional notes..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {editing ? "Save Changes" : "Create"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
