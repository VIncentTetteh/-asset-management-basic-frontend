import api from "@/lib/axios";
import {
    ComplianceControl, ComplianceControlDto,
    BOGControl, BOGControlDto,
    Risk, RiskDto,
    SecurityIncident, SecurityIncidentDto,
    SecurityPolicy, SecurityPolicyDto,
    SecurityZone, SecurityZoneDto,
    ICSAsset, ICSAssetDto,
    PatchRecord, PatchRecordDto,
    PCISAQRecord, PCISAQDto,
    SLAMetric, SLAMetricDto,
    VulnerabilityScan, VulnerabilityScanDto,
    RegulatoryFiling, RegulatoryFilingDto,
    PaginatedResponse,
    ControlStatus,
    RiskStatus,
    FilingStatus,
} from "@/types";
import { extractList, normalizePage } from "@/services/responseUtils";

const BASE = "/compliance";

// ─── 1) Compliance Controls ───────────────────────────────────────────────────
export const complianceControlService = {
    getAll: async (params?: { framework?: string; status?: ControlStatus }): Promise<ComplianceControl[]> => {
        const res = await api.get<ComplianceControl[]>(`${BASE}/controls`, { params });
        return extractList<ComplianceControl>(res.data);
    },
    get: async (id: string): Promise<ComplianceControl> => {
        const res = await api.get<ComplianceControl>(`${BASE}/controls/${id}`);
        return res.data;
    },
    create: async (data: ComplianceControlDto): Promise<ComplianceControl> => {
        const res = await api.post<ComplianceControl>(`${BASE}/controls`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<ComplianceControlDto>): Promise<ComplianceControl> => {
        const res = await api.patch<ComplianceControl>(`${BASE}/controls/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/controls/${id}`);
    },
};

// ─── 2) BOG Controls ──────────────────────────────────────────────────────────
export const bogControlService = {
    getAll: async (params?: { status?: ControlStatus }): Promise<BOGControl[]> => {
        const res = await api.get<BOGControl[]>(`${BASE}/bog-controls`, { params });
        return extractList<BOGControl>(res.data);
    },
    get: async (id: string): Promise<BOGControl> => {
        const res = await api.get<BOGControl>(`${BASE}/bog-controls/${id}`);
        return res.data;
    },
    create: async (data: BOGControlDto): Promise<BOGControl> => {
        const res = await api.post<BOGControl>(`${BASE}/bog-controls`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<BOGControlDto>): Promise<BOGControl> => {
        const res = await api.patch<BOGControl>(`${BASE}/bog-controls/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/bog-controls/${id}`);
    },
};

// ─── 3) Risk Register ─────────────────────────────────────────────────────────
export const riskService = {
    getAll: async (params?: { status?: RiskStatus; page?: number; size?: number }): Promise<PaginatedResponse<Risk>> => {
        const res = await api.get<PaginatedResponse<Risk>>(`${BASE}/risks`, { params });
        return normalizePage<Risk>(res.data) as PaginatedResponse<Risk>;
    },
    get: async (id: string): Promise<Risk> => {
        const res = await api.get<Risk>(`${BASE}/risks/${id}`);
        return res.data;
    },
    create: async (data: RiskDto): Promise<Risk> => {
        const res = await api.post<Risk>(`${BASE}/risks`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<RiskDto>): Promise<Risk> => {
        const res = await api.patch<Risk>(`${BASE}/risks/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/risks/${id}`);
    },
};

// ─── 4) Security Incidents ────────────────────────────────────────────────────
export const incidentService = {
    getAll: async (params?: { page?: number; size?: number }): Promise<PaginatedResponse<SecurityIncident>> => {
        const res = await api.get<PaginatedResponse<SecurityIncident>>(`${BASE}/incidents`, { params });
        return normalizePage<SecurityIncident>(res.data) as PaginatedResponse<SecurityIncident>;
    },
    get: async (id: string): Promise<SecurityIncident> => {
        const res = await api.get<SecurityIncident>(`${BASE}/incidents/${id}`);
        return res.data;
    },
    create: async (data: SecurityIncidentDto): Promise<SecurityIncident> => {
        const res = await api.post<SecurityIncident>(`${BASE}/incidents`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<SecurityIncidentDto>): Promise<SecurityIncident> => {
        const res = await api.patch<SecurityIncident>(`${BASE}/incidents/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/incidents/${id}`);
    },
};

// ─── 5) Security Policies ─────────────────────────────────────────────────────
export const policyService = {
    getAll: async (): Promise<SecurityPolicy[]> => {
        const res = await api.get<SecurityPolicy[]>(`${BASE}/policies`);
        return extractList<SecurityPolicy>(res.data);
    },
    get: async (id: string): Promise<SecurityPolicy> => {
        const res = await api.get<SecurityPolicy>(`${BASE}/policies/${id}`);
        return res.data;
    },
    create: async (data: SecurityPolicyDto): Promise<SecurityPolicy> => {
        const res = await api.post<SecurityPolicy>(`${BASE}/policies`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<SecurityPolicyDto>): Promise<SecurityPolicy> => {
        const res = await api.patch<SecurityPolicy>(`${BASE}/policies/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/policies/${id}`);
    },
};

// ─── 6) Security Zones ────────────────────────────────────────────────────────
export const securityZoneService = {
    getAll: async (): Promise<SecurityZone[]> => {
        const res = await api.get<SecurityZone[]>(`${BASE}/security-zones`);
        return extractList<SecurityZone>(res.data);
    },
    get: async (id: string): Promise<SecurityZone> => {
        const res = await api.get<SecurityZone>(`${BASE}/security-zones/${id}`);
        return res.data;
    },
    create: async (data: SecurityZoneDto): Promise<SecurityZone> => {
        const res = await api.post<SecurityZone>(`${BASE}/security-zones`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<SecurityZoneDto>): Promise<SecurityZone> => {
        const res = await api.patch<SecurityZone>(`${BASE}/security-zones/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/security-zones/${id}`);
    },
};

// ─── 7) ICS Assets ────────────────────────────────────────────────────────────
export const icsAssetService = {
    getAll: async (): Promise<ICSAsset[]> => {
        const res = await api.get<ICSAsset[]>(`${BASE}/ics-assets`);
        return extractList<ICSAsset>(res.data);
    },
    get: async (id: string): Promise<ICSAsset> => {
        const res = await api.get<ICSAsset>(`${BASE}/ics-assets/${id}`);
        return res.data;
    },
    create: async (data: ICSAssetDto): Promise<ICSAsset> => {
        const res = await api.post<ICSAsset>(`${BASE}/ics-assets`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<ICSAssetDto>): Promise<ICSAsset> => {
        const res = await api.patch<ICSAsset>(`${BASE}/ics-assets/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/ics-assets/${id}`);
    },
};

// ─── 8) Patch Records ─────────────────────────────────────────────────────────
export const patchRecordService = {
    getAll: async (params?: { assetId?: string; page?: number; size?: number }): Promise<PaginatedResponse<PatchRecord>> => {
        const res = await api.get<PaginatedResponse<PatchRecord>>(`${BASE}/patch-records`, { params });
        return normalizePage<PatchRecord>(res.data) as PaginatedResponse<PatchRecord>;
    },
    get: async (id: string): Promise<PatchRecord> => {
        const res = await api.get<PatchRecord>(`${BASE}/patch-records/${id}`);
        return res.data;
    },
    create: async (data: PatchRecordDto): Promise<PatchRecord> => {
        const res = await api.post<PatchRecord>(`${BASE}/patch-records`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<PatchRecordDto>): Promise<PatchRecord> => {
        const res = await api.patch<PatchRecord>(`${BASE}/patch-records/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/patch-records/${id}`);
    },
};

// ─── 9) PCI SAQ Records ───────────────────────────────────────────────────────
export const pciSaqService = {
    getAll: async (): Promise<PCISAQRecord[]> => {
        const res = await api.get<PCISAQRecord[]>(`${BASE}/pci-saq`);
        return extractList<PCISAQRecord>(res.data);
    },
    get: async (id: string): Promise<PCISAQRecord> => {
        const res = await api.get<PCISAQRecord>(`${BASE}/pci-saq/${id}`);
        return res.data;
    },
    create: async (data: PCISAQDto): Promise<PCISAQRecord> => {
        const res = await api.post<PCISAQRecord>(`${BASE}/pci-saq`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<PCISAQDto>): Promise<PCISAQRecord> => {
        const res = await api.patch<PCISAQRecord>(`${BASE}/pci-saq/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/pci-saq/${id}`);
    },
};

// ─── 10) SLA Metrics ──────────────────────────────────────────────────────────
export const slaMetricService = {
    getAll: async (): Promise<SLAMetric[]> => {
        const res = await api.get<SLAMetric[]>(`${BASE}/sla-metrics`);
        return extractList<SLAMetric>(res.data);
    },
    get: async (id: string): Promise<SLAMetric> => {
        const res = await api.get<SLAMetric>(`${BASE}/sla-metrics/${id}`);
        return res.data;
    },
    create: async (data: SLAMetricDto): Promise<SLAMetric> => {
        const res = await api.post<SLAMetric>(`${BASE}/sla-metrics`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<SLAMetricDto>): Promise<SLAMetric> => {
        const res = await api.patch<SLAMetric>(`${BASE}/sla-metrics/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/sla-metrics/${id}`);
    },
};

// ─── 11) Vulnerability Scans ──────────────────────────────────────────────────
export const vulnScanService = {
    getAll: async (params?: { page?: number; size?: number }): Promise<PaginatedResponse<VulnerabilityScan>> => {
        const res = await api.get<PaginatedResponse<VulnerabilityScan>>(`${BASE}/vulnerability-scans`, { params });
        return normalizePage<VulnerabilityScan>(res.data) as PaginatedResponse<VulnerabilityScan>;
    },
    get: async (id: string): Promise<VulnerabilityScan> => {
        const res = await api.get<VulnerabilityScan>(`${BASE}/vulnerability-scans/${id}`);
        return res.data;
    },
    create: async (data: VulnerabilityScanDto): Promise<VulnerabilityScan> => {
        const res = await api.post<VulnerabilityScan>(`${BASE}/vulnerability-scans`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<VulnerabilityScanDto>): Promise<VulnerabilityScan> => {
        const res = await api.patch<VulnerabilityScan>(`${BASE}/vulnerability-scans/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/vulnerability-scans/${id}`);
    },
};

// ─── 12) Regulatory Filings ───────────────────────────────────────────────────
export const regulatoryFilingService = {
    getAll: async (params?: { status?: FilingStatus }): Promise<RegulatoryFiling[]> => {
        const res = await api.get<RegulatoryFiling[]>(`${BASE}/regulatory-filings`, { params });
        return extractList<RegulatoryFiling>(res.data);
    },
    get: async (id: string): Promise<RegulatoryFiling> => {
        const res = await api.get<RegulatoryFiling>(`${BASE}/regulatory-filings/${id}`);
        return res.data;
    },
    create: async (data: RegulatoryFilingDto): Promise<RegulatoryFiling> => {
        const res = await api.post<RegulatoryFiling>(`${BASE}/regulatory-filings`, data);
        return res.data;
    },
    update: async (id: string, data: Partial<RegulatoryFilingDto>): Promise<RegulatoryFiling> => {
        const res = await api.patch<RegulatoryFiling>(`${BASE}/regulatory-filings/${id}`, data);
        return res.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/regulatory-filings/${id}`);
    },
};

// ─── BOG ICT Directive Report ─────────────────────────────────────────────────

export interface BogReportSummary {
    totalControls: number;
    implemented: number;
    partial: number;
    notImplemented: number;
    notApplicable: number;
    compliancePercent: number;
    overallStatus: string;
}

export interface BogReportDomain {
    domain: string;
    totalControls: number;
    implemented: number;
    partial: number;
    notImplemented: number;
    compliancePercent: number;
}

export interface BogReport {
    reportType: string;
    organisationId: string;
    organisationName: string;
    generatedAt: string;
    summary: BogReportSummary;
    domains: BogReportDomain[];
    controls?: BOGControl[];
}

export const bogReportService = {
    /** GET /compliance/bog/report — Full BOG ICT Directive compliance report (JSON) */
    getReport: async (): Promise<BogReport> => {
        const res = await api.get<BogReport>(`${BASE}/bog/report`);
        return res.data;
    },

    /** GET /compliance/bog/report/pdf — Download BOG compliance report as PDF blob */
    downloadPdf: async (): Promise<Blob> => {
        const res = await api.get(`${BASE}/bog/report/pdf`, {
            responseType: "blob",
        });
        return res.data as Blob;
    },

    /**
     * POST /compliance/bog/controls — Create or upsert a BOG control by directiveRef.
     * Request: { directiveRef, requirement, status, gapDescription?, remediationPlan?, targetDate?, evidenceUrl? }
     * Response: { id, directiveRef, status }
     */
    upsertControl: async (data: BOGControlDto): Promise<{ id: string; directiveRef: string; status: string }> => {
        const res = await api.post<{ id: string; directiveRef: string; status: string }>(
            `${BASE}/bog/controls`,
            data
        );
        return res.data;
    },

    /**
     * PATCH /compliance/bog/controls/{id}/status — Update the status of a single BOG control.
     * Request: { status: string }
     * Response: { id, directiveRef, status }
     */
    updateControlStatus: async (
        id: string,
        status: string
    ): Promise<{ id: string; directiveRef: string; status: string }> => {
        const res = await api.patch<{ id: string; directiveRef: string; status: string }>(
            `${BASE}/bog/controls/${id}/status`,
            { status }
        );
        return res.data;
    },
};
