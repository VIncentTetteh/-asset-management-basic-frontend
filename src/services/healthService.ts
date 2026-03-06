import api from "@/lib/axios";
import { SystemHealth, DetailedHealth, ApiMetrics, EndpointMetric, ThroughputMetric, ErrorMetric } from "@/types";

export const healthService = {
    getHealth: async (): Promise<SystemHealth> => {
        const response = await api.get<SystemHealth>("/health");
        return response.data;
    },
    getDetailedHealth: async (): Promise<DetailedHealth> => {
        const response = await api.get<DetailedHealth>("/health/detailed");
        return response.data;
    },
    getMetrics: async (params?: { period?: "day" | "week" | "month"; metric?: "requests" | "errors" | "latency" }): Promise<ApiMetrics> => {
        const response = await api.get<ApiMetrics>("/metrics", { params });
        return response.data;
    },
    getEndpointMetrics: async (params?: { sortBy?: "latency" | "requests" | "errorRate" }): Promise<{ timestamp: string; totalEndpoints: number; endpoints: EndpointMetric[] }> => {
        const response = await api.get("/metrics/endpoints", { params });
        return response.data;
    },
    getThroughputMetrics: async (params?: { hours?: number }): Promise<{ period: string; timestamp: string; throughput: ThroughputMetric[] }> => {
        const response = await api.get("/metrics/throughput", { params });
        return response.data;
    },
    getErrorMetrics: async (): Promise<{ totalErrors: number; errorRate: string; errors: ErrorMetric[] }> => {
        const response = await api.get("/metrics/errors");
        return response.data;
    }
};
