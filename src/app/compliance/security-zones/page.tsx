"use client";

import { Network } from "lucide-react";
import type { SecurityZone, SecurityZoneDto } from "@/types";
import { securityZoneService } from "@/services/complianceService";
import { ComplianceCrudPage, defaultsFrom, type FieldSpec } from "@/features/compliance/ComplianceCrudPage";

const PURDUE_OPTIONS = [
  { value: "0", label: "0 — Field devices (sensors/actuators)" },
  { value: "1", label: "1 — Controllers (PLCs/RTUs)" },
  { value: "2", label: "2 — Supervisory (SCADA/HMI)" },
  { value: "3", label: "3 — Operations" },
  { value: "4", label: "4 — Enterprise" },
  { value: "5", label: "5 — DMZ" },
];

const FIELDS: FieldSpec<SecurityZoneDto>[] = [
  { name: "name", label: "Zone name", type: "text", required: true, placeholder: "OT production floor" },
  { name: "purdueLevel", label: "Purdue level", type: "select", required: true, options: PURDUE_OPTIONS },
  { name: "description", label: "Description", type: "textarea" },
  { name: "networkRange", label: "Network range", type: "text", mono: true, placeholder: "10.20.0.0/16" },
  { name: "allowedProtocols", label: "Allowed protocols", type: "text", placeholder: "Modbus, OPC-UA" },
];

const CREATE_DEFAULTS = { name: "", purdueLevel: 3 } as const;

export default function SecurityZonesPage() {
  return (
    <ComplianceCrudPage<SecurityZone, SecurityZoneDto>
      title="Security zones"
      entity="Zone"
      icon={Network}
      description="Purdue-model network segmentation for OT/ICS environments."
      service={securityZoneService}
      moduleKey="security-zones"
      columns={[
        { header: "Zone", kind: "primary", key: "name", subKey: "description" },
        { header: "Purdue level", kind: "number", key: "purdueLevel", right: true },
        { header: "Network range", kind: "mono", key: "networkRange" },
        { header: "Protocols", kind: "text", key: "allowedProtocols" },
      ]}
      fields={FIELDS}
      toFormDefaults={(e) => defaultsFrom(e, FIELDS, CREATE_DEFAULTS)}
      toPayload={(d) => ({ ...d, purdueLevel: Number(d.purdueLevel) })}
      searchKeys={["name", "networkRange", "description"]}
      emptyDescription="Segment industrial networks by Purdue level with protocol allowlists."
    />
  );
}
