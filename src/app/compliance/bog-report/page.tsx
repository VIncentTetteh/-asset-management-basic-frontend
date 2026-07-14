"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  ShieldCheck, Download, RefreshCw, Loader2, Plus, Pencil,
  BarChart3, Building2, ExternalLink,
} from "lucide-react";
import type { BogReportDomain } from "@/services/complianceService";
import type { BOGControl, BOGControlDto, ControlStatus } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import DocumentAttachments from "@/components/DocumentAttachments";
import { useBogReport, useBogControlsList, useUpsertBogControl, useUpdateBogControlStatus } from "@/features/compliance/bogReportHooks";

const STATUSES: ControlStatus[] = ["IMPLEMENTED", "PARTIAL", "NOT_IMPLEMENTED", "NOT_APPLICABLE"];

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

function ringColor(pct: number) {
  return pct >= 80 ? "var(--status-in-use)" : pct >= 50 ? "var(--status-maintenance)" : "var(--status-flagged)";
}

function DomainBar({ domain }: { domain: BogReportDomain }) {
  const pct = Math.round(domain.compliancePercent ?? 0);
  const color = ringColor(pct);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{domain.domain}</span>
        <span className="data-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="data-mono flex gap-3 text-xs text-faint-fg">
        <span style={{ color: "var(--status-in-use)" }}>{domain.implemented} done</span>
        <span style={{ color: "var(--status-maintenance)" }}>{domain.partial} partial</span>
        <span style={{ color: "var(--status-flagged)" }}>{domain.notImplemented} missing</span>
        <span>{domain.totalControls} total</span>
      </div>
    </div>
  );
}

function ComplianceRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = ringColor(pct);
  return (
    <svg width="136" height="136" viewBox="0 0 136 136">
      <circle cx="68" cy="68" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle
        cx="68" cy="68" r={r} fill="none"
        stroke={color} strokeWidth="12"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round"
        transform="rotate(-90 68 68)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="68" y="68" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="700" fill={color} className="data-mono">
        {Math.round(pct)}%
      </text>
      <text x="68" y="86" textAnchor="middle" fontSize="11" fill="var(--text-faint)">compliant</text>
    </svg>
  );
}

export default function BogReportPage() {
  const { data: report, isLoading: reportLoading, refetch } = useBogReport();
  const { data: controls = [], isLoading: controlsLoading } = useBogControlsList();
  const upsertControl = useUpsertBogControl();
  const updateStatus = useUpdateBogControlStatus();

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [tab, setTab] = useState<"overview" | "controls">("overview");
  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [editControl, setEditControl] = useState<BOGControl | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BOGControlDto>();

  useEffect(() => {
    if (!isUpsertOpen) return;
    reset({
      directiveRef: editControl?.directiveRef || "",
      requirement: editControl?.requirement || "",
      status: editControl?.status || "NOT_IMPLEMENTED",
      gapDescription: editControl?.gapDescription || "",
      remediationPlan: editControl?.remediationPlan || "",
      targetDate: editControl?.targetDate?.split("T")[0] || "",
      evidenceUrl: editControl?.evidenceUrl || "",
    });
  }, [isUpsertOpen, editControl, reset]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const { bogReportService } = await import("@/services/complianceService");
      const blob = await bogReportService.downloadPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BOG_Compliance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const openUpsert = (ctrl?: BOGControl) => {
    setEditControl(ctrl || null);
    setIsUpsertOpen(true);
  };

  const onUpsert = async (data: BOGControlDto) => {
    await upsertControl.mutateAsync(data);
    setIsUpsertOpen(false);
  };

  const columns = useMemo<ColumnDef<BOGControl, unknown>[]>(
    () => [
      {
        accessorKey: "directiveRef",
        header: "Ref",
        cell: ({ row }) => <AssetTag tag={row.original.directiveRef} />,
      },
      {
        id: "requirement",
        header: "Requirement",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-64">
            <p className="truncate text-foreground" title={row.original.requirement}>{row.original.requirement}</p>
            {row.original.evidenceUrl ? (
              <a
                href={row.original.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ea-focus mt-0.5 inline-flex items-center gap-1 rounded-sm text-xs text-brand hover:underline"
              >
                Evidence <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ),
      },
      {
        id: "gap",
        header: "Gap",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-52 truncate text-xs text-muted-fg" title={row.original.gapDescription ?? undefined}>
            {row.original.gapDescription || "—"}
          </span>
        ),
      },
      {
        accessorKey: "targetDate",
        header: "Target",
        cell: ({ row }) => (
          <span className="text-xs text-muted-fg">
            {row.original.targetDate ? new Date(row.original.targetDate).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Select
              value={row.original.status}
              onChange={(e) => updateStatus.mutate({ id: row.original.id, status: e.target.value })}
              className="h-8 w-40 py-0 text-xs"
              disabled={updateStatus.isPending}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit control" onClick={() => openUpsert(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [updateStatus],
  );

  const isLoading = reportLoading || controlsLoading;
  const summary = report?.summary;
  const pct = summary?.compliancePercent ?? 0;

  return (
    <ListPageTemplate
      title="BoG ICT directive compliance"
      subtitle={
        isLoading
          ? "Loading report…"
          : `Report for ${report?.organisationName ?? "your organisation"} — generated ${fmt(report?.generatedAt)}`
      }
      actions={
        <>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>
            {isDownloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={() => openUpsert()}>
            <Plus className="mr-2 h-4 w-4" /> Add / update control
          </Button>
        </>
      }
      toolbar={
        <div className="flex gap-1.5">
          <Button variant={tab === "overview" ? "default" : "outline"} size="sm" onClick={() => setTab("overview")}>
            Overview
          </Button>
          <Button variant={tab === "controls" ? "default" : "outline"} size="sm" onClick={() => setTab("controls")}>
            Controls ({controls.length})
          </Button>
        </div>
      }
    >
      {summary ? (
        <div
          className="mb-4 flex items-center gap-3 rounded-card border px-5 py-3"
          style={{ borderColor: `color-mix(in srgb, ${ringColor(pct)} 35%, var(--border))`, background: `color-mix(in srgb, ${ringColor(pct)} 8%, var(--surface))` }}
        >
          <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: ringColor(pct) }} />
          <p className="text-sm font-medium" style={{ color: ringColor(pct) }}>
            Overall status: <strong>{summary.overallStatus}</strong> — {Math.round(pct)}% of controls implemented
          </p>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="flex items-center justify-center py-6">
              <ComplianceRing pct={pct} />
            </Card>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
              {[
                { label: "Total controls", value: summary?.totalControls ?? 0, tone: "text-foreground" },
                { label: "Implemented", value: summary?.implemented ?? 0, tone: "text-[var(--status-in-use)]" },
                { label: "Partial", value: summary?.partial ?? 0, tone: "text-[var(--status-maintenance)]" },
                { label: "Not implemented", value: summary?.notImplemented ?? 0, tone: "text-[var(--status-flagged)]" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pb-4 pt-5">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken">
                      <BarChart3 className={`h-4 w-4 ${s.tone}`} />
                    </div>
                    <p className={`data-mono text-2xl font-bold ${s.tone}`}>{s.value}</p>
                    <p className="mt-0.5 text-xs text-faint-fg">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-brand" />
                Compliance by domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(report?.domains ?? []).length === 0 ? (
                <p className="text-sm text-faint-fg">No domain data available in report.</p>
              ) : (
                (report?.domains ?? []).map((d, i) => <DomainBar key={i} domain={d} />)
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={controls}
          isLoading={controlsLoading}
          emptyTitle="No controls recorded yet"
          emptyDescription="Add BoG directive controls to start tracking implementation status."
          emptyAction={
            <Button size="sm" onClick={() => openUpsert()}>
              <Plus className="mr-1.5 h-4 w-4" /> Add first control
            </Button>
          }
        />
      )}

      <Modal
        isOpen={isUpsertOpen}
        onClose={() => setIsUpsertOpen(false)}
        title={editControl ? "Update BoG control" : "Add BoG control"}
        description="Upsert by directive reference — a control with the same reference is updated, not duplicated."
      >
        <form onSubmit={handleSubmit(onUpsert)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-ref">Directive reference <span className="text-danger">*</span></Label>
            <Input id="b-ref" className="data-mono" placeholder="BOG-ICT-2.1.3" {...register("directiveRef", { required: "Directive reference is required" })} />
            {errors.directiveRef && <p className="text-sm text-danger">{errors.directiveRef.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-req">Requirement <span className="text-danger">*</span></Label>
            <Textarea id="b-req" placeholder="Describe the BoG requirement…" {...register("requirement", { required: "Requirement is required" })} />
            {errors.requirement && <p className="text-sm text-danger">{errors.requirement.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-status">Status</Label>
            <Select id="b-status" {...register("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-gap">Gap description</Label>
            <Textarea id="b-gap" placeholder="What is missing or incomplete?" {...register("gapDescription")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-plan">Remediation plan</Label>
            <Textarea id="b-plan" placeholder="Steps to achieve compliance…" {...register("remediationPlan")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-date">Target date</Label>
            <Input id="b-date" type="date" {...register("targetDate")} />
          </div>
          {editControl?.id ? (
            <div className="space-y-1.5">
              <Label>Evidence documents</Label>
              {editControl.evidenceUrl ? (
                <p className="mb-1 text-xs text-muted-fg">
                  Legacy link:{" "}
                  <a href={editControl.evidenceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    {editControl.evidenceUrl}
                  </a>
                </p>
              ) : null}
              <DocumentAttachments entityType="BOG_CONTROL" entityId={editControl.id} />
            </div>
          ) : null}
          <div className="flex gap-3 border-t border-edge-subtle pt-4">
            <Button type="submit" isLoading={upsertControl.isPending} className="flex-1">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {editControl ? "Update control" : "Save control"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsUpsertOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </form>
      </Modal>
    </ListPageTemplate>
  );
}
