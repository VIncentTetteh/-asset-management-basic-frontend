import api from "@/lib/axios";
import { extractList } from "@/services/responseUtils";

/** DsarRequest.RequestType on the API. */
export type DsarType = "ACCESS" | "RECTIFICATION" | "ERASURE" | "PORTABILITY" | "OBJECTION";

/** DsarRequest.Status on the API; COMPLETED and REJECTED are final. */
export type DsarStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

/** DsarRequestDto on the API. */
export interface DsarDto {
  id?: string;
  requesterEmail?: string;
  requestType?: DsarType | string;
  status?: DsarStatus | string;
  submittedAt?: string;
  /** Statutory response deadline (submission + 30 days). */
  dueAt?: string;
  completedAt?: string;
  assignedToUserId?: string;
  notes?: string;
  responseSummary?: string;
}

/** CreateDsarRequest on the API. */
export interface DsarSubmission {
  requesterEmail: string;
  requestType: DsarType | string;
  notes?: string;
}

/** UpdateDsarStatusRequest on the API (PATCH body). */
export interface DsarStatusUpdate {
  status: DsarStatus | string;
  /** Omitted leaves it; "" clears it. */
  responseSummary?: string;
  assignedToUserId?: string;
  /** True removes the assignee. */
  clearAssignee?: boolean;
}

/** The list endpoint pages; the screen shows the most recent page of this size. */
const PAGE_SIZE = 200;

export const dsarService = {
  /** POST /dpa/dsar — record a data subject request (30-day clock starts). */
  submit: async (dto: DsarSubmission): Promise<DsarDto> => {
    const response = await api.post<DsarDto>("/dpa/dsar", dto);
    return response.data;
  },

  /** GET /dpa/dsar — a Spring page; returns its content. */
  listAll: async (): Promise<DsarDto[]> => {
    const response = await api.get("/dpa/dsar", { params: { size: PAGE_SIZE, sort: "submittedAt,desc" } });
    return extractList<DsarDto>(response.data);
  },

  /** GET /dpa/dsar/{id} */
  getById: async (id: string): Promise<DsarDto> => {
    const response = await api.get<DsarDto>(`/dpa/dsar/${id}`);
    return response.data;
  },

  /**
   * PATCH /dpa/dsar/{id}/status with a JSON body: the response summary can hold
   * personal data, which must not travel in the URL.
   */
  updateStatus: async (id: string, update: DsarStatusUpdate): Promise<DsarDto> => {
    const response = await api.patch<DsarDto>(`/dpa/dsar/${id}/status`, update);
    return response.data;
  },
};
