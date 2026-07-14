"use client";

import { AlertTriangle } from "lucide-react";
import type { Risk, RiskDto } from "@/types";
import { riskService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<RiskDto>[] = [
  { name: "title", label: "Risk title", type: "text", required: true, span2: true, placeholder: "Unpatched ATM fleet firmware" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "framework", label: "Framework", type: "select", options: [{ value: "ISO_27001", label: "ISO 27001" }, { value: "SOC2", label: "SOC 2" }, { value: "PCI_DSS", label: "PCI DSS" }, { value: "ICS", label: "ICS" }, { value: "BOG", label: "BoG" }] },
  { name: "riskId", label: "Risk ID", type: "text", mono: true, placeholder: "RSK-014" },
  { name: "likelihood", label: "Likelihood (1–5)", type: "number", required: true, min: 1, max: 5 },
  { name: "impact", label: "Impact (1–5)", type: "number", required: true, min: 1, max: 5 },
  { name: "treatment", label: "Treatment", type: "select", options: [
    { value: "MITIGATE", label: "Mitigate" }, { value: "ACCEPT", label: "Accept" },
    { value: "TRANSFER", label: "Transfer" }, { value: "AVOID", label: "Avoid" },
  ] },
  { name: "status", label: "Status", type: "select", options: [
    { value: "OPEN", label: "Open" }, { value: "IN_TREATMENT", label: "In treatment" },
    { value: "CLOSED", label: "Closed" }, { value: "ACCEPTED", label: "Accepted" },
  ] },
  { name: "mitigationPlan", label: "Mitigation plan", type: "textarea" },
  { name: "residualRisk", label: "Residual risk (1–25)", type: "number", min: 1, max: 25 },
  { name: "reviewDate", label: "Review date", type: "date" },
];

const CREATE_DEFAULTS = { title: "", likelihood: 3, impact: 3, status: "OPEN", treatment: "MITIGATE" } as const;

export default function RisksPage() {
  return (
    <ComplianceCrudPage<Risk, RiskDto>
      title="Risk register"
      entity="Risk"
      icon={AlertTriangle}
      description="Likelihood × impact scored risks with treatment plans."
      service={riskService}
      moduleKey="risks"
      columns={[
        { header: "Risk", kind: "primary", key: "title", subKey: "riskId" },
        { header: "Score", kind: "number", key: "likelihood", right: true,
           render: (r) => <span className="data-mono block text-right font-bold">{(r.likelihood || 0) * (r.impact || 0)}</span> },
        { header: "Treatment", kind: "text", key: "treatment" },
        { header: "Review", kind: "date", key: "reviewDate" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      toPayload={(d) => ({ ...d, likelihood: Number(d.likelihood), impact: Number(d.impact),
        residualRisk: d.residualRisk != null && String(d.residualRisk) !== "" ? Number(d.residualRisk) : undefined })}
      searchKeys={["title", "riskId"]}
      emptyDescription="Register operational and security risks scored by likelihood and impact."
    />
  );
}
