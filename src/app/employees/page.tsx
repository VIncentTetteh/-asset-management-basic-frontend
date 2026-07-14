"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import type { EmployeeDto, EmployeeStatus } from "@/services/employeeService";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSpinner } from "@/components/ui/spinner";
import { usePagedEmployees, useEmployeeMasterData } from "@/features/employees/hooks";
import { EmployeeFormModal } from "@/features/employees/EmployeeFormModal";

const STATUSES: EmployeeStatus[] = ["ONBOARDING", "ACTIVE", "ON_LEAVE", "OFFBOARDING", "TERMINATED"];

function EmployeesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "">("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Debounce the search box.
  useMemo(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = usePagedEmployees({
    q: debouncedQ || undefined,
    status: statusFilter || undefined,
    departmentId: departmentId || undefined,
    page,
    size: 20,
  });
  const master = useEmployeeMasterData();

  const columns = useMemo<ColumnDef<EmployeeDto, unknown>[]>(
    () => [
      {
        accessorKey: "lastName",
        header: "Employee",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="truncate text-xs text-faint-fg">{row.original.jobTitle || "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "employeeNumber",
        header: "Number",
        cell: ({ row }) =>
          row.original.employeeNumber ? (
            <span className="data-mono text-xs">{row.original.employeeNumber}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        id: "department",
        header: "Department",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{row.original.departmentName || "—"}</span>,
      },
      {
        id: "email",
        header: "Email",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{row.original.email || "—"}</span>,
      },
      {
        accessorKey: "activeAssetCount",
        header: () => <span className="block text-right">Assets held</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">{row.original.activeAssetCount ?? 0}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ONBOARDING"} />,
      },
    ],
    [],
  );

  const total = data?.totalElements ?? 0;

  return (
    <ListPageTemplate
      title="Employees"
      subtitle={isLoading ? "Loading employees…" : `${total.toLocaleString()} employees on record`}
      actions={
        <Button onClick={() => setIsFormOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> New employee
        </Button>
      }
      toolbar={
        <>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
            <Input
              placeholder="Search name, number, or email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as EmployeeStatus | "");
              setPage(0);
            }}
            className="w-40"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </Select>
          <Select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(0);
            }}
            className="w-44"
          >
            <option value="">All departments</option>
            {master.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={data?.content ?? []}
        isLoading={isLoading}
        onRowClick={(emp) => router.push(`/employees/${emp.id}`)}
        pageInfo={{
          page,
          size: data?.size ?? 20,
          totalElements: total,
          totalPages: data?.totalPages ?? 1,
        }}
        onPageChange={setPage}
        emptyTitle="No employees yet"
        emptyDescription="Employees can hold assets without needing a system login — add your first record."
        emptyAction={
          <Button size="sm" onClick={() => setIsFormOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" /> New employee
          </Button>
        }
      />

      <EmployeeFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingEmployee={null}
        departments={master.departments}
        users={master.users}
      />
    </ListPageTemplate>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<PageSpinner label="Loading employees…" />}>
      <EmployeesPageInner />
    </Suspense>
  );
}
