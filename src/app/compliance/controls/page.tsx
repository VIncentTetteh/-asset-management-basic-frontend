"use client";

import { ShieldCheck } from "lucide-react";
import type { ComplianceControl, ComplianceControlDto } from "@/types";
import { complianceControlService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<ComplianceControlDto>[] = [
  { name: "framework", label: "Framework", type: "select", required: true, options: [{ value: "ISO_27001", label: "ISO 27001" }, { value: "SOC2", label: "SOC 2" }, { value: "PCI_DSS", label: "PCI DSS" }, { value: "ICS", label: "ICS" }, { value: "BOG", label: "BoG" }] },
  { name: "controlRef", label: "Control reference", type: "text", required: true, mono: true, placeholder: "A.5.1" },
  { name: "controlName", label: "Control name", type: "text", required: true, span2: true, placeholder: "Information security policies" },
  { name: "controlDescription", label: "Description", type: "textarea" },
  { name: "status", label: "Status", type: "select", options: [{ value: "NOT_IMPLEMENTED", label: "Not implemented" }, { value: "PARTIAL", label: "Partial" }, { value: "IMPLEMENTED", label: "Implemented" }, { value: "NOT_APPLICABLE", label: "Not applicable" }] },
  { name: "reviewDueDate", label: "Review due", type: "date" },
  { name: "justification", label: "Justification", type: "textarea" },
  { name: "gapDescription", label: "Gap description", type: "textarea" },
  { name: "remediationPlan", label: "Remediation plan", type: "textarea" },
  { name: "evidenceUrl", label: "Evidence URL", type: "text", span2: true, placeholder: "https://…" },
];

const CREATE_DEFAULTS = { framework: "ISO_27001", controlRef: "", controlName: "", status: "NOT_IMPLEMENTED" } as const;

export default function ComplianceControlsPage() {
  return (
    <ComplianceCrudPage<ComplianceControl, ComplianceControlDto>
      title="Compliance controls"
      entity="Control"
      icon={ShieldCheck}
      description="Framework controls with implementation status, gaps, and evidence."
      service={complianceControlService}
      moduleKey="compliance-controls"
      columns={[
        { header: "Control", kind: "primary", key: "controlName", subKey: "controlRef" },
        { header: "Framework", kind: "text", key: "framework" },
        { header: "Review due", kind: "date", key: "reviewDueDate" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["controlName", "controlRef", "framework"]}
      emptyDescription="Track ISO 27001 / SOC 2 / PCI DSS controls and their implementation evidence."
    />
  );
}
