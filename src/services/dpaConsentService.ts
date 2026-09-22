import api from "@/lib/axios";
import { extractList } from "@/services/responseUtils";

export type ConsentPurpose =
  | "MARKETING"
  | "ANALYTICS"
  | "DATA_SHARING"
  | "PROFILING"
  | "THIRD_PARTY"
  | "COMMUNICATIONS"
  | "OTHER";

/**
 * ConsentRecordDto on the API. Consent is recorded by the signed-in user for
 * themselves (the API takes the subject from the session); administrators see
 * the organisation's ledger.
 */
export interface ConsentRecordDto {
  id?: string;
  userId?: string;
  purpose?: ConsentPurpose | string;
  granted?: boolean;
  grantedAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

const PAGE_SIZE = 500;

export const dpaConsentService = {
  /** POST /dpa/consent — grant (or decline) consent for a purpose, as the current user. */
  record: async (purpose: string, granted: boolean): Promise<ConsentRecordDto> => {
    // The API records the IP address and user agent from the request itself.
    const response = await api.post<ConsentRecordDto>("/dpa/consent", { purpose, granted });
    return response.data;
  },

  /** GET /dpa/consent — the organisation's consent ledger (a Spring page). */
  listAll: async (): Promise<ConsentRecordDto[]> => {
    const response = await api.get("/dpa/consent", { params: { size: PAGE_SIZE } });
    return extractList<ConsentRecordDto>(response.data);
  },

  /** GET /dpa/consent/check?purpose= — whether the current user has active consent. */
  check: async (purpose: string): Promise<boolean> => {
    const response = await api.get<boolean>("/dpa/consent/check", { params: { purpose } });
    return response.data === true;
  },

  /** DELETE /dpa/consent/{purpose} — withdraw the current user's consent. */
  revoke: async (purpose: string): Promise<ConsentRecordDto> => {
    const response = await api.delete<ConsentRecordDto>(`/dpa/consent/${encodeURIComponent(purpose)}`);
    return response.data;
  },
};
