"use client";

import { Building2 } from "lucide-react";
import type { BOGControl, BOGControlDto } from "@/types";
import { bogControlService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<BOGControlDto>[] = [
  { name: "directiveRef", label: "Directive reference", type: "text", required: true, mono: true, placeholder: "BoG/ICT/1.2" },
  { name: "status", label: "Status", type: "select", options: [{ value: "NOT_IMPLEMENTED", label: "Not implemented" }, { value: "PARTIAL", label: "Partial" }, { value: "IMPLEMENTED", label: "Implemented" }, { value: "NOT_APPLICABLE", label: "Not applicable" }] },
  { name: "requirement", label: "Requirement", type: "textarea", required: true },
  { name: "gapDescription", label: "Gap description", type: "textarea" },
  { name: "remediationPlan", label: "Remediation plan", type: "textarea" },
  { name: "targetDate", label: "Target date", type: "date" },
  { name: "evidenceUrl", label: "Evidence URL", type: "text", placeholder: "https://…" },
];

const CREATE_DEFAULTS = { directiveRef: "", requirement: "", status: "NOT_IMPLEMENTED" } as const;

export default function BogControlsPage() {
  return (
    <ComplianceCrudPage<BOGControl, BOGControlDto>
      title="Bank of Ghana controls"
      entity="Control"
      icon={Building2}
      description="BoG ICT directive requirements and their implementation status."
      service={bogControlService}
      moduleKey="bog-controls"
      columns={[
        { header: "Directive", kind: "mono", key: "directiveRef" },
        { header: "Requirement", kind: "primary", key: "requirement" },
        { header: "Target date", kind: "date", key: "targetDate" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["directiveRef", "requirement"]}
      emptyDescription="Track compliance with the Bank of Ghana ICT & cybersecurity directive."
    />
  );
}
