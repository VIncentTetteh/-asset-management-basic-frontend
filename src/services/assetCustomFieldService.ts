import api from "@/lib/axios";
import { AssetCustomField, AssetCustomFieldDto } from "@/types";

export const assetCustomFieldService = {
    /** GET /assets/{assetId}/custom-fields */
    getFields: async (assetId: string): Promise<AssetCustomField[]> => {
        const response = await api.get<AssetCustomField[]>(`/assets/${assetId}/custom-fields`);
        return response.data;
    },

    /** POST /assets/{assetId}/custom-fields */
    createField: async (assetId: string, data: AssetCustomFieldDto): Promise<AssetCustomField> => {
        const response = await api.post<AssetCustomField>(`/assets/${assetId}/custom-fields`, data);
        return response.data;
    },

    /** PUT /assets/{assetId}/custom-fields/{fieldId} */
    updateField: async (assetId: string, fieldId: string, data: AssetCustomFieldDto): Promise<AssetCustomField> => {
        const response = await api.put<AssetCustomField>(`/assets/${assetId}/custom-fields/${fieldId}`, data);
        return response.data;
    },

    /** DELETE /assets/{assetId}/custom-fields/{fieldId} */
    deleteField: async (assetId: string, fieldId: string): Promise<void> => {
        await api.delete(`/assets/${assetId}/custom-fields/${fieldId}`);
    }
};
