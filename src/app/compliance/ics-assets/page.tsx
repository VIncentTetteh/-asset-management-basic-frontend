"use client";

import { Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ICSAsset, ICSAssetDto } from "@/types";
import { icsAssetService, securityZoneService } from "@/services/complianceService";
import { assetService } from "@/services/assetService";
import { qk } from "@/lib/queryClient";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const FIELDS: FieldSpec<ICSAssetDto>[] = [
  { name: "assetId", label: "Asset", type: "select", required: true },
  { name: "securityZoneId", label: "Security zone", type: "select" },
  { name: "firmwareVersion", label: "Firmware version", type: "text", mono: true },
  { name: "protocol", label: "Protocol", type: "text", placeholder: "Modbus TCP" },
  { name: "vendorSupportStatus", label: "Vendor support", type: "select", options: [
    { value: "SUPPORTED", label: "Supported" }, { value: "END_OF_LIFE", label: "End of life" },
    { value: "END_OF_SUPPORT", label: "End of support" }, { value: "UNKNOWN", label: "Unknown" },
  ] },
  { name: "lastPatchedAt", label: "Last patched", type: "date" },
  { name: "knownVulnerabilities", label: "Known vulnerabilities", type: "textarea" },
  { name: "isolated", label: "Network isolated", type: "checkbox" },
  { name: "notes", label: "Notes", type: "textarea" },
];

const CREATE_DEFAULTS = { assetId: "", isolated: false, vendorSupportStatus: "SUPPORTED" } as const;

export default function IcsAssetsPage() {
  return (
    <ComplianceCrudPage<ICSAsset, ICSAssetDto>
      title="ICS assets"
      entity="ICS asset"
      icon={Cpu}
      description="Industrial control system assets with firmware and isolation tracking."
      service={icsAssetService}
      moduleKey="ics-assets"
      columns={[
        { header: "Asset", kind: "primary", key: "assetName", subKey: "protocol" },
        { header: "Zone", kind: "text", key: "securityZoneName" },
        { header: "Firmware", kind: "mono", key: "firmwareVersion" },
        { header: "Last patched", kind: "date", key: "lastPatchedAt" },
        { header: "Isolated", kind: "bool", key: "isolated" },
        { header: "Support", kind: "status", key: "vendorSupportStatus" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      searchKeys={["assetName", "firmwareVersion", "protocol"]}
      emptyDescription="Register PLCs, RTUs, and SCADA components with their security posture."
      useOptions={() => {
        const { data: assets = [] } = useQuery({
          queryKey: qk.module("assets-all").list(),
          queryFn: () => assetService.getAll(),
          staleTime: 300_000,
        });
        const { data: zones = [] } = useQuery({
          queryKey: qk.module("security-zones").list(),
          queryFn: () => securityZoneService.getAll(),
          staleTime: 300_000,
        });
        return {
          assetId: assets.map((a) => ({ value: a.id!, label: `${a.name} (${a.assetTag || "no tag"})` })),
          securityZoneId: zones.map((z) => ({ value: z.id!, label: z.name })),
        };
      }}
    />
  );
}
