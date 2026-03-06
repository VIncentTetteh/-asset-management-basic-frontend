"use client";

import { useEffect, useState } from "react";
import { healthService } from "@/services/healthService";
import { DetailedHealth, ApiMetrics } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Activity, Server, Clock } from "lucide-react";
import { toast } from "react-hot-toast";

export default function HealthPage() {
    const [health, setHealth] = useState<DetailedHealth | null>(null);
    const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            healthService.getDetailedHealth().catch(() => null),
            healthService.getMetrics().catch(() => null)
        ]).then(([h, m]) => {
            setHealth(h);
            setMetrics(m);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
        <Activity className="text-blue-500" /> System Health Monitoring
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/> Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium text-muted-foreground">Global Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${health?.status === 'UP' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {health?.status || 'UNKNOWN'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium text-muted-foreground">Uptime</span>
              <span>{health?.uptime || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-muted-foreground">Version</span>
              <span className="font-mono">{health?.version || 'v1'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> API Metrics (Last 24h)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium text-muted-foreground">Total Requests</span>
              <span>{metrics?.totalRequests?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium text-muted-foreground">Success Rate</span>
              <span className="text-green-600 font-bold">{metrics?.successRate || '0%'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-muted-foreground">Avg Latency</span>
              <span>{metrics?.averageLatency || 0} ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mt-8">Component Status Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {health?.components && Object.entries(health.components).map(([name, detail]: [string, any]) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={detail.status === 'UP' ? 'text-green-600' : 'text-red-600'}>{detail.status}</span>
                </div>
                {Object.entries(detail).filter(([k]) => k !== 'status').map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="font-mono text-xs">{String(v)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div >
  );
}
