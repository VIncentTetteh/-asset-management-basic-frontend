import api from "@/lib/axios";

export type ExpenseCategory =
  | "MAINTENANCE"
  | "TRAVEL"
  | "SUPPLIES"
  | "SOFTWARE"
  | "HARDWARE"
  | "INSURANCE"
  | "OTHER";

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface ExpenseDto {
  id?: string;
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  receiptUrl?: string;
  rejectionReason?: string;
  approvedAt?: string;
  createdAt?: string;
  organisationId?: string;
  submittedById?: string;
  submittedByName?: string;
  approvedById?: string;
  linkedAssetId?: string;
  linkedBudgetId?: string;
  departmentId?: string;
}

export const expenseService = {
  /** POST /expenses — Submit a new expense for approval. */
  submit: async (dto: Partial<ExpenseDto>): Promise<ExpenseDto> => {
    const response = await api.post<ExpenseDto>("/expenses", dto);
    return response.data;
  },

  /** GET /expenses/{id} */
  getById: async (id: string): Promise<ExpenseDto> => {
    const response = await api.get<ExpenseDto>(`/expenses/${id}`);
    return response.data;
  },

  /** GET /expenses — All expenses for the current org. */
  listAll: async (): Promise<ExpenseDto[]> => {
    const response = await api.get<ExpenseDto[]>("/expenses");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /expenses/pending — SUBMITTED expenses awaiting approval. */
  listPending: async (): Promise<ExpenseDto[]> => {
    const response = await api.get<ExpenseDto[]>("/expenses/pending");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** GET /expenses/users/{userId} — Expenses submitted by a specific user. */
  listByUser: async (userId: string): Promise<ExpenseDto[]> => {
    const response = await api.get<ExpenseDto[]>(`/expenses/users/${userId}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  /** POST /expenses/{id}/approve — Approve a submitted expense. */
  approve: async (id: string): Promise<ExpenseDto> => {
    const response = await api.post<ExpenseDto>(`/expenses/${id}/approve`);
    return response.data;
  },

  /** POST /expenses/{id}/reject — Reject a submitted expense with an optional reason. */
  reject: async (id: string, reason?: string): Promise<ExpenseDto> => {
    const response = await api.post<ExpenseDto>(`/expenses/${id}/reject`, {
      reason,
    });
    return response.data;
  },

  /** DELETE /expenses/{id} */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};
