"use client";

import { useEffect, useState } from "react";
import { webhookService } from "@/services/webhookService";
import { Webhook } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Webhook as WebhookIcon, Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";

export default function WebhooksPage() {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWebhooks();
    }, []);

    const fetchWebhooks = async () => {
        try {
            const data = await webhookService.list();
            setWebhooks(data.webhooks);
            setStats({ total: data.totalWebhooks, active: data.activeWebhooks });
        } catch (e) {
            toast.error("Failed to fetch webhooks");
        } finally {
            setLoading(false);
        }
    };

    const toggleWebhook = async (id: string, currentStatus: boolean) => {
        try {
            await webhookService.update(id, { active: !currentStatus });
            toast.success(`Webhook ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchWebhooks();
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const testWebhook = async (id: string) => {
    try {
      await webhookService.testWebhook(id);
      toast.success("Test payload sent successfully");
      fetchWebhooks();
    } catch {
      toast.error("Test delivery failed");
    }
  };

  if (loading) return <div className="flex p-10 justify-center"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <WebhookIcon className="text-indigo-500" /> Webhooks Integrations
        </h1>
        <Button><Plus className="w-4 h-4 mr-2" /> Add Webhook</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Configured Webhooks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active Webhooks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Name & URL</th>
                  <th className="px-6 py-3">Events</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Deliveries</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id} className="border-b">
                    <td className="px-6 py-4">
                      <div className="font-bold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.url || "Omitted URL"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {w.events.map(e => (
                          <span key={e} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">{e}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {w.active ? <span className="flex items-center text-green-600 text-xs font-bold"><CheckCircle className="w-3 h-3 mr-1"/> ACTIVE</span> : <span className="flex items-center text-slate-400 text-xs font-bold"><XCircle className="w-3 h-3 mr-1"/> INACTIVE</span>}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {w.deliveryCount} total<br/>
                      <span className="text-muted-foreground">Last: {w.lastTriggeredAt ? new Date(w.lastTriggeredAt).toLocaleString() : 'Never'}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => testWebhook(w.id)}>Test</Button>
                      <Button variant={w.active ? "secondary" : "default"} size="sm" onClick={() => toggleWebhook(w.id, w.active)}>
                        {w.active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!webhooks.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">No webhooks configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
