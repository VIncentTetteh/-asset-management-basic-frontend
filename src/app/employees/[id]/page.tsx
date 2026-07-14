"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil, UserMinus, ClipboardList, CheckCircle2 } from "lucide-react";
import type { EmployeeDto, EmployeeChecklistDto } from "@/services/employeeService";
import type { CheckoutRecordDto } from "@/services/checkoutService";
import { DetailPageTemplate } from "@/components/templates/DetailPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { PageSpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  useEmployee,
  useEmployeeAssets,
  useEmployeeChecklists,
  useEmployeeMasterData,
  useCompleteChecklistItem,
} from "@/features/employees/hooks";
import { EmployeeFormModal } from "@/features/employees/EmployeeFormModal";
import { OnboardModal, OffboardModal } from "@/features/employees/OnboardOffboardModals";

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function OverviewTab({ employee }: { employee: EmployeeDto }) {
  const facts: [string, React.ReactNode][] = [
    ["Employee number", employee.employeeNumber ? <span className="data-mono">{employee.employeeNumber}</span> : "—"],
    ["Job title", employee.jobTitle || "—"],
    ["Department", employee.departmentName || "—"],
    ["Manager", employee.managerName || "—"],
    ["Email", employee.email || "—"],
    ["Phone", employee.phone || "—"],
    ["Hire date", fmtDate(employee.hireDate)],
    ["Termination date", fmtDate(employee.terminationDate)],
    ["System login", employee.userId ? "Linked" : "None — asset custodian only"],
  ];
  return (
    <Card>
      <CardContent className="pt-5">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">{label}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {employee.notes ? (
          <div className="mt-5 border-t border-edge-subtle pt-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-faint-fg">Notes</p>
            <p className="mt-1 text-sm text-muted-fg">{employee.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AssetsTab({ records, isLoading }: { records: CheckoutRecordDto[]; isLoading: boolean }) {
  const columns = useMemo<ColumnDef<CheckoutRecordDto, unknown>[]>(
    () => [
      {
        accessorKey: "assetName",
        header: "Asset",
        cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.assetName || "—"}</span>,
      },
      {
        accessorKey: "checkedOutAt",
        header: "Issued",
        cell: ({ row }) => <span className="text-muted-fg">{fmtDate(row.original.checkedOutAt)}</span>,
      },
      {
        accessorKey: "actualReturnDate",
        header: "Returned",
        cell: ({ row }) => <span className="text-muted-fg">{fmtDate(row.original.actualReturnDate)}</span>,
      },
      {
        id: "condition",
        header: "Condition",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-fg">
            {row.original.conditionOnReturn || row.original.conditionOnCheckout || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
      },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      data={records}
      isLoading={isLoading}
      emptyTitle="No assets on record"
      emptyDescription="Assets issued to this employee — through onboarding or checkouts — appear here."
    />
  );
}

function ChecklistsTab({
  checklists,
  isLoading,
}: {
  checklists: EmployeeChecklistDto[];
  isLoading: boolean;
}) {
  const completeItem = useCompleteChecklistItem();

  if (isLoading) return <PageSpinner label="Loading checklists…" />;
  if (checklists.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No checklists yet"
          description="Onboarding and offboarding checklists appear here once started."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {checklists.map((cl) => {
        const done = cl.items.filter((i) => i.completed).length;
        return (
          <Card key={cl.id}>
            <CardContent className="pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-foreground">
                    {cl.checklistType === "ONBOARDING" ? "Onboarding" : "Offboarding"}
                  </span>
                  <StatusBadge status={cl.status} />
                </div>
                <span className="data-mono text-xs text-muted-fg">
                  {done}/{cl.items.length} done
                  {cl.completedAt ? ` · completed ${fmtDate(cl.completedAt)}` : ""}
                </span>
              </div>
              <div className="divide-y divide-edge-subtle">
                {cl.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      aria-label={item.completed ? "Completed" : `Complete: ${item.title}`}
                      disabled={item.completed || completeItem.isPending || cl.status === "COMPLETED"}
                      onClick={() => completeItem.mutate({ itemId: item.id!, completed: true })}
                      className={cn(
                        "ea-focus flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        item.completed
                          ? "border-brand bg-brand text-brand-contrast"
                          : "border-edge bg-surface hover:border-brand",
                      )}
                    >
                      {item.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          item.completed ? "text-faint-fg line-through" : "text-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      {item.completed && item.completedByName ? (
                        <p className="text-xs text-faint-fg">
                          by {item.completedByName} · {fmtDate(item.completedAt)}
                        </p>
                      ) : null}
                    </div>
                    {item.itemType !== "GENERAL" ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          item.itemType === "ASSET_ISSUE" ? "bg-info-soft text-info" : "bg-warn-soft text-warn",
                        )}
                      >
                        {item.itemType === "ASSET_ISSUE" ? "Issue asset" : "Return asset"}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: employee, isLoading } = useEmployee(id);
  const { data: assetRecords = [], isLoading: assetsLoading } = useEmployeeAssets(id);
  const { data: checklists = [], isLoading: checklistsLoading } = useEmployeeChecklists(id);
  const master = useEmployeeMasterData();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [onboardTarget, setOnboardTarget] = useState<EmployeeDto | null>(null);
  const [offboardTarget, setOffboardTarget] = useState<EmployeeDto | null>(null);

  if (isLoading || !employee) return <PageSpinner label="Loading employee…" />;

  const activeAssets = assetRecords.filter((r) => r.status === "ACTIVE").length;
  const openChecklists = checklists.filter((c) => c.status === "OPEN").length;
  const canOnboard = employee.status === "ONBOARDING" || employee.status === "ACTIVE";
  const canOffboard = employee.status !== "TERMINATED" && employee.status !== "OFFBOARDING";

  return (
    <>
      <DetailPageTemplate
        backHref="/employees"
        backLabel="Employees"
        title={`${employee.firstName} ${employee.lastName}`}
        titleAccessory={<StatusBadge status={employee.status ?? "ONBOARDING"} />}
        meta={
          <>
            {employee.jobTitle ? <span>{employee.jobTitle}</span> : null}
            {employee.departmentName ? <span>{employee.departmentName}</span> : null}
            {employee.employeeNumber ? <span className="data-mono">{employee.employeeNumber}</span> : null}
            <span>
              <span className="data-mono">{activeAssets}</span> asset{activeAssets === 1 ? "" : "s"} held
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            {canOnboard && (
              <Button variant="outline" onClick={() => setOnboardTarget(employee)}>
                <ClipboardList className="mr-1.5 h-4 w-4" /> Onboard
              </Button>
            )}
            {canOffboard && (
              <Button variant="destructive" onClick={() => setOffboardTarget(employee)}>
                <UserMinus className="mr-1.5 h-4 w-4" /> Offboard
              </Button>
            )}
          </>
        }
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab employee={employee} /> },
          {
            id: "assets",
            label: "Assets",
            count: activeAssets,
            content: <AssetsTab records={assetRecords} isLoading={assetsLoading} />,
          },
          {
            id: "checklists",
            label: "Checklists",
            count: openChecklists,
            content: <ChecklistsTab checklists={checklists} isLoading={checklistsLoading} />,
          },
        ]}
      />

      <EmployeeFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        editingEmployee={employee}
        departments={master.departments}
        users={master.users}
      />
      <OnboardModal employee={onboardTarget} onClose={() => setOnboardTarget(null)} assets={master.assets} />
      <OffboardModal employee={offboardTarget} onClose={() => setOffboardTarget(null)} />
    </>
  );
}
