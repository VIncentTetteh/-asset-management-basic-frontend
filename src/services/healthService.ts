import api from "@/lib/axios";
import { SystemHealth, DetailedHealth, ApiMetrics, EndpointMetric, ThroughputMetric, ErrorMetric, DatabaseMetrics } from "@/types";

const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeApiMetrics = (payload: unknown): ApiMetrics => {
    const data = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    const rawJvm = data.jvm && typeof data.jvm === "object"
        ? data.jvm
        : data.jvmMetrics && typeof data.jvmMetrics === "object"
            ? data.jvmMetrics
            : null;
    const rawDatabase = data.database && typeof data.database === "object"
        ? data.database
        : data.databaseMetrics && typeof data.databaseMetrics === "object"
            ? data.databaseMetrics
            : null;

    return {
        period: String(data.period || "day"),
        timestamp: String(data.timestamp || new Date().toISOString()),
        totalRequests: toNumber(data.totalRequests ?? data.requestCount),
        successfulRequests: toNumber(data.successfulRequests ?? data.successCount),
        failedRequests: toNumber(data.failedRequests ?? data.errorCount),
        successRate: String(data.successRate || "0%"),
        averageLatency: toNumber(data.averageLatency ?? data.avgLatencyMs),
        p50Latency: toNumber(data.p50Latency),
        p95Latency: toNumber(data.p95Latency),
        p99Latency: toNumber(data.p99Latency),
        maxLatency: toNumber(data.maxLatency),
        errorRate: String(data.errorRate || "0%"),
        topErrors: Array.isArray(data.topErrors) ? data.topErrors as ApiMetrics["topErrors"] : [],
        slowestEndpoints: Array.isArray(data.slowestEndpoints) ? data.slowestEndpoints as ApiMetrics["slowestEndpoints"] : [],
        uptime: typeof data.uptime === "string" ? data.uptime : undefined,
        jvm: rawJvm as ApiMetrics["jvm"],
        database: rawDatabase as ApiMetrics["database"],
        raw: data,
    };
};

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
        const response = await api.get("/metrics", { params });
        return normalizeApiMetrics(response.data);
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
    },
    getDatabaseMetrics: async (): Promise<DatabaseMetrics> => {
        const response = await api.get<DatabaseMetrics>("/metrics/database");
        return response.data;
    }
};
