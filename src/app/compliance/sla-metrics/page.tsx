"use client";

import { TrendingUp } from "lucide-react";
import type { SLAMetric, SLAMetricDto } from "@/types";
import { slaMetricService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const now = new Date();

const FIELDS: FieldSpec<SLAMetricDto>[] = [
  { name: "month", label: "Month (1–12)", type: "number", required: true, min: 1, max: 12 },
  { name: "year", label: "Year", type: "number", required: true, min: 2000, max: 2100 },
  { name: "uptimePercent", label: "Uptime %", type: "number", required: true, step: "0.001", min: 0, max: 100 },
  { name: "incidentCount", label: "Incidents", type: "number", min: 0 },
  { name: "plannedDowntimeMinutes", label: "Planned downtime (min)", type: "number", min: 0 },
  { name: "unplannedDowntimeMinutes", label: "Unplanned downtime (min)", type: "number", min: 0 },
  { name: "rtoMinutes", label: "RTO (min)", type: "number", min: 0 },
  { name: "rpoMinutes", label: "RPO (min)", type: "number", min: 0 },
  { name: "slaBreached", label: "SLA breached this period", type: "checkbox" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const CREATE_DEFAULTS = {
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  uptimePercent: 99.9,
  slaBreached: false,
} as const;

export default function SlaMetricsPage() {
  return (
    <ComplianceCrudPage<SLAMetric, SLAMetricDto>
      title="SLA metrics"
      entity="SLA metric"
      icon={TrendingUp}
      description="Monthly uptime, downtime, and recovery objectives."
      service={slaMetricService}
      moduleKey="sla-metrics"
      columns={[
        { header: "Period", kind: "primary", key: "month",
          render: (m) => <span className="data-mono font-semibold text-foreground">{String(m.year)}-{String(m.month).padStart(2, "0")}</span> },
        { header: "Uptime", kind: "number", key: "uptimePercent", right: true,
          render: (m) => <span className={`data-mono block text-right ${m.slaBreached ? "font-bold text-danger" : ""}`}>{Number(m.uptimePercent).toFixed(3)}%</span> },
        { header: "Incidents", kind: "number", key: "incidentCount", right: true },
        { header: "Unplanned (min)", kind: "number", key: "unplannedDowntimeMinutes", right: true },
        { header: "Breached", kind: "bool", key: "slaBreached" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      toPayload={(d) => ({
        ...d,
        month: Number(d.month), year: Number(d.year), uptimePercent: Number(d.uptimePercent),
        incidentCount: d.incidentCount != null && String(d.incidentCount) !== "" ? Number(d.incidentCount) : undefined,
        plannedDowntimeMinutes: d.plannedDowntimeMinutes != null && String(d.plannedDowntimeMinutes) !== "" ? Number(d.plannedDowntimeMinutes) : undefined,
        unplannedDowntimeMinutes: d.unplannedDowntimeMinutes != null && String(d.unplannedDowntimeMinutes) !== "" ? Number(d.unplannedDowntimeMinutes) : undefined,
        rtoMinutes: d.rtoMinutes != null && String(d.rtoMinutes) !== "" ? Number(d.rtoMinutes) : undefined,
        rpoMinutes: d.rpoMinutes != null && String(d.rpoMinutes) !== "" ? Number(d.rpoMinutes) : undefined,
      })}
      searchKeys={["year", "month"]}
      emptyDescription="Record monthly service levels against your availability commitments."
    />
  );
}
