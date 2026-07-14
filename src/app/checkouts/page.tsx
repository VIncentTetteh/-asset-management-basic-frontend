"use client";

import { useMemo, useState } from "react";
import { PackageCheck, AlertTriangle, CheckCircle2, Package, Search } from "lucide-react";
import type { CheckoutRecordDto } from "@/services/checkoutService";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckouts, useCheckoutMasterData } from "@/features/checkouts/hooks";
import { CheckoutTable, isOverdue } from "@/features/checkouts/CheckoutTable";
import { CheckOutModal, CheckInModal } from "@/features/checkouts/CheckoutModals";

export default function CheckoutsPage() {
  const [view, setView] = useState<"all" | "overdue">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "RETURNED" | "OVERDUE">("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<CheckoutRecordDto | null>(null);

  const { data: records = [], isLoading } = useCheckouts(view);
  const master = useCheckoutMasterData();

  const stats = useMemo(
    () => ({
      active: records.filter((r) => r.status === "ACTIVE").length,
      overdue: records.filter((r) => r.status === "OVERDUE" || isOverdue(r)).length,
      returned: records.filter((r) => r.status === "RETURNED").length,
    }),
    [records],
  );

  const filtered = useMemo(() => {
    let list = records;
    if (statusFilter === "OVERDUE") list = list.filter(isOverdue);
    else if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.assetName || "").toLowerCase().includes(q) ||
          (r.checkedOutByName || "").toLowerCase().includes(q) ||
          (r.employeeName || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [records, statusFilter, searchTerm]);

  const statCards = [
    { label: "Active checkouts", value: stats.active, icon: Package, tone: "text-[var(--status-in-stock)]" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, tone: "text-danger" },
    { label: "Returned", value: stats.returned, icon: CheckCircle2, tone: "text-[var(--status-in-use)]" },
  ];

  return (
    <ListPageTemplate
      title="Checkouts"
      subtitle="Who holds what, and when it's due back."
      actions={
        <Button onClick={() => setIsCheckoutOpen(true)}>
          <PackageCheck className="mr-2 h-4 w-4" /> Check out asset
        </Button>
      }
      toolbar={
        <>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
            <Input
              placeholder="Search by asset or holder…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-40"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="RETURNED">Returned</option>
            <option value="OVERDUE">Overdue</option>
          </Select>
          <div className="flex gap-1.5">
            <Button variant={view === "all" ? "default" : "outline"} size="sm" onClick={() => setView("all")}>
              All
            </Button>
            <Button
              variant={view === "overdue" ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setView("overdue")}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Overdue
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statCards.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-card border border-edge bg-surface p-3.5">
              <s.icon className={`h-4.5 w-4.5 shrink-0 ${s.tone}`} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">{s.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-5 w-10" />
                ) : (
                  <p className="data-mono text-lg font-bold leading-6 text-foreground">{s.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <CheckoutTable records={filtered} isLoading={isLoading} onCheckIn={setCheckInTarget} />
      </div>

      <CheckOutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        assets={master.assets}
        users={master.users}
      />
      <CheckInModal record={checkInTarget} onClose={() => setCheckInTarget(null)} />
    </ListPageTemplate>
  );
}
