import api from "@/lib/axios";

export type ConsentPurpose =
  | "MARKETING"
  | "ANALYTICS"
  | "DATA_SHARING"
  | "PROFILING"
  | "THIRD_PARTY"
  | "COMMUNICATIONS"
  | "OTHER";

export interface ConsentRecordDto {
  id?: string;
  subjectId?: string;
  subjectEmail?: string;
  subjectName?: string;
  purpose?: ConsentPurpose | string;
  granted?: boolean;
  ipAddress?: string;
  userAgent?: string;
  consentText?: string;
  expiresAt?: string;
  revokedAt?: string;
  organisationId?: string;
  createdAt?: string;
}

export interface ConsentCheckResult {
  purpose: string;
  granted: boolean;
  subjectId: string;
  expiresAt?: string;
}

export const dpaConsentService = {
  /** POST /dpa/consent — Record a data processing consent */
  record: async (dto: Partial<ConsentRecordDto>): Promise<ConsentRecordDto> => {
    const response = await api.post<ConsentRecordDto>("/dpa/consent", dto);
    return response.data;
  },

  /** GET /dpa/consent — List all consent records for the organisation */
  listAll: async (): Promise<ConsentRecordDto[]> => {
    const response = await api.get<ConsentRecordDto[]>("/dpa/consent");
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * GET /dpa/consent/check — Check consent for a specific purpose
   * @param subjectId   The data subject's ID
   * @param purpose     The processing purpose to check
   */
  check: async (subjectId: string, purpose: string): Promise<ConsentCheckResult> => {
    const response = await api.get<ConsentCheckResult>("/dpa/consent/check", {
      params: { subjectId, purpose },
    });
    return response.data;
  },

  /** DELETE /dpa/consent/{purpose}?subjectId=... — Revoke consent for a purpose */
  revoke: async (purpose: string, subjectId: string): Promise<void> => {
    await api.delete(`/dpa/consent/${purpose}`, { params: { subjectId } });
  },
};
