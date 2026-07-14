"use client";

import { FileText } from "lucide-react";
import type { SecurityPolicy, SecurityPolicyDto } from "@/types";
import { policyService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<SecurityPolicyDto>[] = [
  { name: "title", label: "Policy title", type: "text", required: true, span2: true, placeholder: "Acceptable use policy" },
  { name: "version", label: "Version", type: "text", mono: true, placeholder: "1.0" },
  { name: "status", label: "Status", type: "select", options: [
    { value: "DRAFT", label: "Draft" }, { value: "UNDER_REVIEW", label: "Under review" },
    { value: "APPROVED", label: "Approved" }, { value: "RETIRED", label: "Retired" },
  ] },
  { name: "effectiveDate", label: "Effective date", type: "date" },
  { name: "reviewDueDate", label: "Review due", type: "date" },
  { name: "documentUrl", label: "Document URL", type: "text", span2: true, placeholder: "https://…" },
];

const CREATE_DEFAULTS = { title: "", status: "DRAFT", version: "1.0" } as const;

export default function PoliciesPage() {
  return (
    <ComplianceCrudPage<SecurityPolicy, SecurityPolicyDto>
      title="Security policies"
      entity="Policy"
      icon={FileText}
      description="Policy documents with versioning and review cycles."
      service={policyService}
      moduleKey="security-policies"
      columns={[
        { header: "Policy", kind: "primary", key: "title" },
        { header: "Version", kind: "mono", key: "version" },
        { header: "Effective", kind: "date", key: "effectiveDate" },
        { header: "Review due", kind: "date", key: "reviewDueDate" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["title", "version"]}
      emptyDescription="Maintain the policy library your controls and audits reference."
    />
  );
}
