import api from "@/lib/axios";
import type { CheckoutRecordDto } from "@/services/checkoutService";

/** Mirrors backend EmployeeStatus. */
export type EmployeeStatus = "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "OFFBOARDING" | "TERMINATED";
export type ChecklistType = "ONBOARDING" | "OFFBOARDING";
export type ChecklistStatus = "OPEN" | "COMPLETED";
export type ChecklistItemType = "GENERAL" | "ASSET_ISSUE" | "ASSET_RETURN";

export interface EmployeeDto {
  id?: string;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  departmentName?: string;
  managerId?: string;
  managerName?: string;
  /** Optional link to a system user — not every employee has a login. */
  userId?: string;
  status?: EmployeeStatus;
  hireDate?: string;
  terminationDate?: string;
  notes?: string;
  organisationId?: string;
  /** Read-only: number of ACTIVE checkouts held. */
  activeAssetCount?: number;
}

export interface EmployeeChecklistItemDto {
  id?: string;
  checklistId?: string;
  title: string;
  itemType?: ChecklistItemType;
  assetId?: string;
  assetName?: string;
  checkoutRecordId?: string;
  sortOrder?: number;
  completed?: boolean;
  completedById?: string;
  completedByName?: string;
  completedAt?: string;
}

export interface EmployeeChecklistDto {
  id: string;
  employeeId: string;
  checklistType: ChecklistType;
  status: ChecklistStatus;
  completedAt?: string;
  createdAt?: string;
  items: EmployeeChecklistItemDto[];
}

/** Spring Data Page envelope as serialized by the backend. */
export interface PagedEmployees {
  content: EmployeeDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface EmployeeFilterParams {
  departmentId?: string;
  status?: EmployeeStatus | "";
  q?: string;
  page?: number;
  size?: number;
}

export const employeeService = {
  getPaged: async (params?: EmployeeFilterParams): Promise<PagedEmployees> => {
    const cleaned = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    );
    const response = await api.get<PagedEmployees>("/employees", { params: cleaned });
    return response.data;
  },

  get: async (id: string): Promise<EmployeeDto> => {
    const response = await api.get<EmployeeDto>(`/employees/${id}`);
    return response.data;
  },

  create: async (data: EmployeeDto): Promise<EmployeeDto> => {
    const response = await api.post<EmployeeDto>("/employees", data);
    return response.data;
  },

  update: async (id: string, data: Partial<EmployeeDto>): Promise<EmployeeDto> => {
    const response = await api.put<EmployeeDto>(`/employees/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/employees/${id}`);
  },

  /** Full checkout history (active + returned), newest first. */
  getAssets: async (id: string): Promise<CheckoutRecordDto[]> => {
    const response = await api.get<CheckoutRecordDto[]>(`/employees/${id}/assets`);
    return response.data;
  },

  getChecklists: async (id: string): Promise<EmployeeChecklistDto[]> => {
    const response = await api.get<EmployeeChecklistDto[]>(`/employees/${id}/checklists`);
    return response.data;
  },

  /** Starts onboarding. ASSET_ISSUE items carry assetId and check the asset out on completion. */
  onboard: async (id: string, items: EmployeeChecklistItemDto[]): Promise<EmployeeChecklistDto> => {
    const response = await api.post<EmployeeChecklistDto>(`/employees/${id}/onboard`, items);
    return response.data;
  },

  /** Starts offboarding: one ASSET_RETURN item per held asset + optional extra items. */
  offboard: async (id: string, extraItems: EmployeeChecklistItemDto[] = []): Promise<EmployeeChecklistDto> => {
    const response = await api.post<EmployeeChecklistDto>(`/employees/${id}/offboard`, extraItems);
    return response.data;
  },

  completeChecklistItem: async (itemId: string, completed = true): Promise<EmployeeChecklistItemDto> => {
    const response = await api.patch<EmployeeChecklistItemDto>(
      `/employees/checklists/items/${itemId}`,
      null,
      { params: { completed } },
    );
    return response.data;
  },
};
