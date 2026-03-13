import api from "@/lib/axios";
import { VendorReview, VendorReviewDto, VendorReviewSummary } from "@/types";
import { extractList } from "@/services/responseUtils";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const getOrgId = (): string | undefined => getOrganisationIdFromStorage();

const withOrgParams = (params?: Record<string, string | number | boolean | undefined>) => ({
    ...(params || {}),
    organisationId: getOrgId(),
});

export const vendorReviewService = {
    /** POST /vendor-reviews */
    create: async (data: VendorReviewDto): Promise<VendorReview> => {
        const response = await api.post<VendorReview>("/vendor-reviews", data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** GET /vendor-reviews?supplierId=uuid */
    getAll: async (supplierId?: string): Promise<VendorReview[]> => {
        const response = await api.get("/vendor-reviews", {
            params: withOrgParams(supplierId ? { supplierId } : undefined),
        });
        return extractList<VendorReview>(response.data);
    },

    /** GET /vendor-reviews/suppliers/{supplierId}/summary */
    getSupplierSummary: async (supplierId: string): Promise<VendorReviewSummary> => {
        const response = await api.get<VendorReviewSummary>(
            `/vendor-reviews/suppliers/${supplierId}/summary`,
            { params: withOrgParams() }
        );
        return response.data;
    },

    /** PUT /vendor-reviews/{id} */
    update: async (id: string, data: Partial<VendorReviewDto>): Promise<VendorReview> => {
        const response = await api.put<VendorReview>(`/vendor-reviews/${id}`, data, {
            params: withOrgParams(),
        });
        return response.data;
    },

    /** DELETE /vendor-reviews/{id} */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/vendor-reviews/${id}`, { params: withOrgParams() });
    },
};
