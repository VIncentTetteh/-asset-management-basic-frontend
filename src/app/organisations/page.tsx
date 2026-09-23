"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, Pencil, ShieldCheck, Search } from "lucide-react";
import Link from "next/link";
import type { Organisation, OrganisationDto } from "@/types";
import { OrganisationFormModal } from "@/features/organisations/OrganisationFormModal";
import { organisationService } from "@/services/organisationService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countryName } from "@/lib/countries";
import { StatusBadge } from "@/components/ui/status-badge";
import { reportApiError } from "@/lib/api-validation";
import { CurrencySettingsCard } from "@/components/currency/CurrencySettingsCard";

const getProfileCompleteness = (org: Organisation) => {
  const fields = [org.industry, org.contactEmail, org.contactPhone, org.address, org.country, org.timezone, org.registrationNumber, org.taxId];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

export default function OrganisationsPage() {
  const queryClient = useQueryClient();
  const orgsKey = qk.module("organisations");

  const { data: organisations = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: orgsKey.list(),
    queryFn: () => organisationService.getAll(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: orgsKey.all });

  const saveOrg = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OrganisationDto> }) => organisationService.update(id, data),
    onSuccess: () => {
      toast.success("Organisation updated");
      invalidate();
    },
    // Was the axios message ("Request failed with status code 409"), not the API's reason.
    onError: (error) => reportApiError(error, { fallback: "Failed to save organisation" }),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return organisations;
    return organisations.filter((org) =>
      [org.name, org.industry, org.contactEmail, org.country].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [organisations, searchTerm]);

  const openEdit = (org: Organisation) => setEditingOrg(org);

  const columns = useMemo<ColumnDef<Organisation, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Organisation",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">{row.original.industry || "—"}</p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0 max-w-52">
            <p className="truncate text-muted-fg">{row.original.contactEmail || "—"}</p>
            <p className="truncate text-xs text-faint-fg">{row.original.contactPhone || "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => <span className="text-muted-fg">{countryName(row.original.country) || "—"}</span>,
      },
      {
        id: "profile",
        header: () => <span className="block text-right">Profile</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="data-mono block text-right text-xs text-muted-fg">{getProfileCompleteness(row.original)}%</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status ?? "ACTIVE"} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            {/* SSO lives on its own page, which knows the API's providers and scope format. */}
            <Link
              href="/sso-configuration"
              title="SSO configuration"
              aria-label="Configure SSO"
              className="ea-focus inline-flex h-7 w-7 items-center justify-center rounded-control text-muted-fg hover:bg-surface-muted hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit organisation"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <ListPageTemplate
      title="Organisations"
      subtitle={isLoading ? "Loading organisations…" : `${organisations.length} tenant organisations`}
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input placeholder="Search name, industry, or contact…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
        </div>
      }
    >
      <CurrencySettingsCard />

      <Card className="mb-4">
        <CardContent className="flex items-center gap-3 pt-5">
          <Building2 className="h-4 w-4 shrink-0 text-brand" />
          <p className="text-sm text-muted-fg">
            Each tenant is fully isolated — assets, users, and data never cross organisation boundaries.
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your organisations"
        emptyTitle="No organisations found"
        emptyDescription="Tenant organisations appear here once registered."
      />

      <OrganisationFormModal
        organisation={editingOrg}
        onClose={() => setEditingOrg(null)}
        onSave={(id, data) => saveOrg.mutateAsync({ id, data })}
        isSaving={saveOrg.isPending}
      />

    </ListPageTemplate>
  );
}
