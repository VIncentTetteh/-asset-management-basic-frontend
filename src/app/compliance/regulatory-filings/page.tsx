"use client";

import { FileClock } from "lucide-react";
import type { RegulatoryFiling, RegulatoryFilingDto } from "@/types";
import { regulatoryFilingService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<RegulatoryFilingDto>[] = [
  { name: "filingType", label: "Filing type", type: "text", required: true, placeholder: "Quarterly cyber return" },
  { name: "regulator", label: "Regulator", type: "text", required: true, placeholder: "Bank of Ghana" },
  { name: "dueDate", label: "Due date", type: "date", required: true },
  { name: "status", label: "Status", type: "select", options: [
    { value: "PENDING", label: "Pending" }, { value: "SUBMITTED", label: "Submitted" },
    { value: "OVERDUE", label: "Overdue" }, { value: "ACKNOWLEDGED", label: "Acknowledged" },
    { value: "REJECTED", label: "Rejected" },
  ] },
  { name: "submittedAt", label: "Submitted", type: "date" },
  { name: "reference", label: "Reference", type: "text", mono: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

const CREATE_DEFAULTS = { filingType: "", regulator: "", dueDate: "", status: "PENDING" } as const;

export default function RegulatoryFilingsPage() {
  return (
    <ComplianceCrudPage<RegulatoryFiling, RegulatoryFilingDto>
      title="Regulatory filings"
      entity="Filing"
      icon={FileClock}
      description="Statutory returns and their submission deadlines."
      service={regulatoryFilingService}
      moduleKey="regulatory-filings"
      columns={[
        { header: "Filing", kind: "primary", key: "filingType", subKey: "regulator" },
        { header: "Due", kind: "date", key: "dueDate" },
        { header: "Submitted", kind: "date", key: "submittedAt" },
        { header: "Reference", kind: "mono", key: "reference" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["filingType", "regulator", "reference"]}
      emptyDescription="Never miss a statutory deadline — track filings from pending to acknowledged."
    />
  );
}
