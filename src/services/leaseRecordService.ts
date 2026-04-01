import api from "@/lib/axios";

export type LeaseStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "TERMINATED"
  | "PENDING_RENEWAL";

export interface LeaseRecordDto {
  id?: string;
  assetId?: string;
  assetName?: string;
  lessorId?: string;
  lessorName?: string;
  startDate?: string;
  endDate?: string;
  monthlyPayment?: number;
  currency?: string;
  autoRenew?: boolean;
  noticePeriodDays?: number;
  notes?: string;
  organisationId?: string;
  departmentId?: string;
  status?: LeaseStatus;
  createdAt?: string;
}

export const leaseRecordService = {
  /** POST /leases — Create a new lease record. */
  create: async (dto: Partial<LeaseRecordDto>): Promise<LeaseRecordDto> => {
    const response = await api.post<LeaseRecordDto>("/leases", dto);
    return response.data;
  },

  /** PUT /leases/{id} — Update an existing lease record. */
  update: async (
    id: string,
    dto: Partial<LeaseRecordDto>
  ): Promise<LeaseRecordDto> => {
    const response = await api.put<LeaseRecordDto>(`/leases/${id}`, dto);
    return response.data;
  },

  /** GET /leases/{id} */
  getById: async (id: string): Promise<LeaseRecordDto> => {
    const response = await api.get<LeaseRecordDto>(`/leases/${id}`);
    return response.data;
  },

  /** GET /leases — All lease records for the current org. */
  listAll: async (): Promise<LeaseRecordDto[]> => {
    const response = await api.get<LeaseRecordDto[]>("/leases");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /leases/assets/{assetId} — Leases for a specific asset. */
  listByAsset: async (assetId: string): Promise<LeaseRecordDto[]> => {
    const response = await api.get<LeaseRecordDto[]>(
      `/leases/assets/${assetId}`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * GET /leases/expiring-soon — ACTIVE leases expiring within the next N days.
   * @param days Number of days to look ahead (default 30)
   */
  listExpiringSoon: async (days = 30): Promise<LeaseRecordDto[]> => {
    const response = await api.get<LeaseRecordDto[]>("/leases/expiring-soon", {
      params: { days },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  /** POST /leases/{id}/terminate — Terminate a lease early. */
  terminate: async (id: string, reason?: string): Promise<LeaseRecordDto> => {
    const response = await api.post<LeaseRecordDto>(
      `/leases/${id}/terminate`,
      reason ? { reason } : {}
    );
    return response.data;
  },

  /** DELETE /leases/{id} */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/leases/${id}`);
  },
};
