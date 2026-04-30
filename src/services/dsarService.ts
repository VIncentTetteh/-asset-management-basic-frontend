import api from "@/lib/axios";

export type DsarType =
  | "ACCESS"
  | "ERASURE"
  | "RECTIFICATION"
  | "PORTABILITY"
  | "RESTRICTION"
  | "OBJECTION";

export type DsarStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface DsarDto {
  id?: string;
  requestType?: DsarType | string;
  subjectId?: string;
  subjectEmail?: string;
  subjectName?: string;
  description?: string;
  status?: DsarStatus | string;
  responseNotes?: string;
  dueDate?: string;
  completedAt?: string;
  organisationId?: string;
  createdAt?: string;
}

export interface DsarStatusUpdate {
  status: DsarStatus | string;
  responseNotes?: string;
}

export const dsarService = {
  /** POST /dpa/dsar — Submit a Data Subject Access Request */
  submit: async (dto: Partial<DsarDto>): Promise<DsarDto> => {
    const response = await api.post<DsarDto>("/dpa/dsar", dto);
    return response.data;
  },

  /** GET /dpa/dsar — List all DSAR submissions for the organisation */
  listAll: async (): Promise<DsarDto[]> => {
    const response = await api.get<DsarDto[]>("/dpa/dsar");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /dpa/dsar/{id} — Get a single DSAR by ID */
  getById: async (id: string): Promise<DsarDto> => {
    const response = await api.get<DsarDto>(`/dpa/dsar/${id}`);
    return response.data;
  },

  /** PATCH /dpa/dsar/{id}/status — Update DSAR processing status */
  updateStatus: async (id: string, update: DsarStatusUpdate): Promise<DsarDto> => {
    const response = await api.patch<DsarDto>(`/dpa/dsar/${id}/status`, update);
    return response.data;
  },
};
