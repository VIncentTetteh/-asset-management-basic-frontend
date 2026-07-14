"use client";

import { Siren } from "lucide-react";
import type { SecurityIncident, SecurityIncidentDto } from "@/types";
import { incidentService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<SecurityIncidentDto>[] = [
  { name: "title", label: "Title", type: "text", required: true, span2: true, placeholder: "Phishing campaign targeting finance staff" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "severity", label: "Severity", type: "select", required: true, options: [
    { value: "P1_CRITICAL", label: "P1 — Critical" }, { value: "P2_HIGH", label: "P2 — High" },
    { value: "P3_MEDIUM", label: "P3 — Medium" }, { value: "P4_LOW", label: "P4 — Low" },
  ] },
  { name: "status", label: "Status", type: "select", options: [
    { value: "OPEN", label: "Open" }, { value: "IN_PROGRESS", label: "In progress" },
    { value: "RESOLVED", label: "Resolved" }, { value: "CLOSED", label: "Closed" },
  ] },
  { name: "category", label: "Category", type: "text", placeholder: "Phishing / Malware / Insider…" },
  { name: "detectedAt", label: "Detected", type: "date" },
  { name: "resolvedAt", label: "Resolved", type: "date" },
  { name: "rootCause", label: "Root cause", type: "textarea" },
  { name: "lessonsLearned", label: "Lessons learned", type: "textarea" },
];

const CREATE_DEFAULTS = { title: "", severity: "P3_MEDIUM", status: "OPEN" } as const;

export default function IncidentsPage() {
  return (
    <ComplianceCrudPage<SecurityIncident, SecurityIncidentDto>
      title="Security incidents"
      entity="Incident"
      icon={Siren}
      description="Incident log with severity, resolution, and lessons learned."
      service={incidentService}
      moduleKey="incidents"
      columns={[
        { header: "Incident", kind: "primary", key: "title", subKey: "category" },
        { header: "Severity", kind: "status", key: "severity" },
        { header: "Detected", kind: "date", key: "detectedAt" },
        { header: "Resolved", kind: "date", key: "resolvedAt" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["title", "category"]}
      emptyDescription="Record security incidents from detection through resolution."
    />
  );
}
