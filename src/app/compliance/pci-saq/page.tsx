"use client";

import { CreditCard } from "lucide-react";
import type { PCISAQRecord, PCISAQDto } from "@/types";
import { pciSaqService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<PCISAQDto>[] = [
  { name: "requirementNumber", label: "Requirement", type: "text", required: true, mono: true, placeholder: "3.2.1" },
  { name: "complianceStatus", label: "Answer", type: "select", options: [
    { value: "YES", label: "Yes" }, { value: "NO", label: "No" },
    { value: "NOT_APPLICABLE", label: "Not applicable" },
    { value: "COMPENSATING_CONTROL", label: "Compensating control" },
  ] },
  { name: "requirementText", label: "Requirement text", type: "textarea" },
  { name: "compensatingControl", label: "Compensating control", type: "textarea" },
  { name: "targetDate", label: "Target date", type: "date" },
  { name: "evidenceUrl", label: "Evidence URL", type: "text", placeholder: "https://…" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const CREATE_DEFAULTS = { requirementNumber: "", complianceStatus: "YES" } as const;

export default function PciSaqPage() {
  return (
    <ComplianceCrudPage<PCISAQRecord, PCISAQDto>
      title="PCI-DSS SAQ"
      entity="SAQ record"
      icon={CreditCard}
      description="Self-assessment questionnaire answers per PCI-DSS requirement."
      service={pciSaqService}
      moduleKey="pci-saq"
      columns={[
        { header: "Requirement", kind: "mono", key: "requirementNumber" },
        { header: "Text", kind: "primary", key: "requirementText" },
        { header: "Target", kind: "date", key: "targetDate" },
        { header: "Answer", kind: "status", key: "complianceStatus" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["requirementNumber", "requirementText"]}
      emptyDescription="Answer the PCI-DSS self-assessment questionnaire requirement by requirement."
    />
  );
}
