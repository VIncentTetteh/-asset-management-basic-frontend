import api from "@/lib/axios";

export interface CheckoutRecordDto {
  id?: string;
  assetId?: string;
  assetName?: string;
  checkedOutById?: string;
  checkedOutByName?: string;
  checkedOutAt?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  checkedInById?: string;
  conditionOnCheckout?: string;
  conditionOnReturn?: string;
  notes?: string;
  status?: "ACTIVE" | "RETURNED" | "OVERDUE";
  organisationId?: string;
  /** Employee recipient (Phase 2 backend) — set when the asset was issued to a non-user employee. */
  employeeId?: string;
  employeeName?: string;
}

export interface CheckInDto {
  conditionOnReturn?: string;
  notes?: string;
}

export const checkoutService = {
  /** POST /checkouts/assets/{assetId}/users/{userId} — Check out an asset to a user. */
  checkOut: async (
    assetId: string,
    userId: string,
    dto?: Partial<CheckoutRecordDto>
  ): Promise<CheckoutRecordDto> => {
    const response = await api.post<CheckoutRecordDto>(
      `/checkouts/assets/${assetId}/users/${userId}`,
      dto ?? {}
    );
    return response.data;
  },

  /** POST /checkouts/{checkoutRecordId}/checkin — Return a checked-out asset. */
  checkIn: async (
    checkoutRecordId: string,
    dto?: CheckInDto
  ): Promise<CheckoutRecordDto> => {
    const response = await api.post<CheckoutRecordDto>(
      `/checkouts/${checkoutRecordId}/checkin`,
      dto ?? {}
    );
    return response.data;
  },

  /** GET /checkouts/{id} */
  getById: async (id: string): Promise<CheckoutRecordDto> => {
    const response = await api.get<CheckoutRecordDto>(`/checkouts/${id}`);
    return response.data;
  },

  /** GET /checkouts — All checkout records for the current org. */
  listAll: async (): Promise<CheckoutRecordDto[]> => {
    const response = await api.get<CheckoutRecordDto[]>("/checkouts");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /checkouts/assets/{assetId} — Checkout history for a specific asset. */
  listByAsset: async (assetId: string): Promise<CheckoutRecordDto[]> => {
    const response = await api.get<CheckoutRecordDto[]>(
      `/checkouts/assets/${assetId}`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /checkouts/users/{userId} — Checkout history for a specific user. */
  listByUser: async (userId: string): Promise<CheckoutRecordDto[]> => {
    const response = await api.get<CheckoutRecordDto[]>(
      `/checkouts/users/${userId}`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /checkouts/overdue — Active checkouts past their expected return date. */
  listOverdue: async (): Promise<CheckoutRecordDto[]> => {
    const response = await api.get<CheckoutRecordDto[]>("/checkouts/overdue");
    return Array.isArray(response.data) ? response.data : [];
  },
};
