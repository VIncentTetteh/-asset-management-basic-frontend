"use client";

import { PackageCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { PatchRecord, PatchRecordDto } from "@/types";
import { patchRecordService } from "@/services/complianceService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<PatchRecordDto>[] = [
  { name: "assetId", label: "Asset", type: "select", required: true },
  { name: "patchName", label: "Patch name", type: "text", required: true, placeholder: "KB5034441" },
  { name: "version", label: "Version", type: "text", mono: true },
  { name: "status", label: "Status", type: "select", options: [
    { value: "PLANNED", label: "Planned" }, { value: "APPLIED", label: "Applied" },
    { value: "FAILED", label: "Failed" }, { value: "ROLLED_BACK", label: "Rolled back" },
  ] },
  { name: "appliedAt", label: "Applied", type: "date" },
  { name: "testEnvironmentValidated", label: "Validated in test environment", type: "checkbox" },
  { name: "rollbackPlan", label: "Rollback plan", type: "textarea" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const CREATE_DEFAULTS = { assetId: "", patchName: "", status: "PLANNED", testEnvironmentValidated: false } as const;

export default function PatchRecordsPage() {
  return (
    <ComplianceCrudPage<PatchRecord, PatchRecordDto>
      title="Patch records"
      entity="Patch record"
      icon={PackageCheck}
      description="Patch deployments per asset with test validation and rollback plans."
      service={patchRecordService}
      moduleKey="patch-records"
      columns={[
        { header: "Patch", kind: "primary", key: "patchName", subKey: "version" },
        { header: "Asset", kind: "text", key: "assetName" },
        { header: "Applied", kind: "date", key: "appliedAt" },
        { header: "Test validated", kind: "bool", key: "testEnvironmentValidated" },
        { header: "Status", kind: "status", key: "status" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["patchName", "assetName", "version"]}
      emptyDescription="Track patch rollout across the estate — planned, applied, or rolled back."
      useOptions={() => {
        const { data: assets = [] } = useQuery({
          queryKey: qk.module("assets-all").list(),
          queryFn: () => assetService.getAll(),
          staleTime: 300_000,
        });
        return {
          assetId: assets.map((a) => ({ value: a.id!, label: `${a.name} (${a.assetTag || "no tag"})` })),
        };
      }}
    />
  );
}
