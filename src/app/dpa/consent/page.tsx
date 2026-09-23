"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, XCircle, CheckCircle2, Search } from "lucide-react";
import { dpaConsentService, CONSENT_PAGE_SIZE, type ConsentRecordDto, type ConsentPurpose } from "@/services/dpaConsentService";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import axios from "axios";
import { reportApiError } from "@/lib/api-validation";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { DataErrorState } from "@/components/patterns/DataErrorState";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const PURPOSES: { value: ConsentPurpose; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "DATA_SHARING", label: "Data sharing" },
  { value: "PROFILING", label: "Profiling" },
  { value: "THIRD_PARTY", label: "Third party" },
  { value: "COMMUNICATIONS", label: "Communications" },
  { value: "OTHER", label: "Other" },
];

const purposeLabel = (p?: string) => PURPOSES.find((x) => x.value === p)?.label || p || "—";

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** A consent is active when granted and not since withdrawn. */
const isActive = (c: ConsentRecordDto) => !!c.granted && !c.revokedAt;

/**
 * The API records consent for the signed-in user (the subject comes from the
 * session), so this card is where a user grants or withdraws their own consent
 * per purpose. The ledger below is the organisation-wide record.
 */
function MyConsentCard({ onChanged }: { onChanged: () => void }) {
  const [purpose, setPurpose] = useState<ConsentPurpose>("MARKETING");
  const { data: active, isLoading, refetch } = useQuery({
    queryKey: ["dpa-consent", "mine", purpose],
    queryFn: () => dpaConsentService.check(purpose),
  });
  const change = useMutation({
    mutationFn: (grant: boolean) => (grant ? dpaConsentService.record(purpose, true) : dpaConsentService.revoke(purpose)),
    onSuccess: (_res, grant) => {
      toast.success(grant ? "Consent granted" : "Consent withdrawn");
      void refetch();
      onChanged();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to update your consent" }),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-brand" /> My consent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-end gap-3 sm:flex-row">
          <div className="space-y-1.5">
            <Label htmlFor="my-purpose">Purpose</Label>
            <Select id="my-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as ConsentPurpose)} className="w-48">
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <p className="flex-1 pb-2 text-sm text-muted-fg">
            {isLoading ? "Checking…" : active ? "You have consented to this purpose." : "You have not consented to this purpose."}
          </p>
          {active ? (
            <Button variant="outline" onClick={() => change.mutate(false)} isLoading={change.isPending}>
              <XCircle className="mr-1.5 h-4 w-4" /> Withdraw
            </Button>
          ) : (
            <Button onClick={() => change.mutate(true)} isLoading={change.isPending} disabled={isLoading}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Grant consent
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** A 403 is a permission condition; anything else is a failed request. */
function isConsentForbidden(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 403;
}

export default function DpaConsentPage() {
  const queryClient = useQueryClient();
  const consentsKey = qk.module("dpa-consent");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);

  // The ledger is paged server-side: it used to be fetched 500 rows at a time
  // and anything past that was invisible. The search narrows the page on screen.
  const { data: pageData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [...consentsKey.list(), page],
    queryFn: () => dpaConsentService.list({ page }),
  });
  const consents = useMemo(() => pageData?.items ?? [], [pageData]);
  const total = pageData?.total ?? 0;
  const { data: users = [] } = useQuery({
    queryKey: qk.module("users").list(),
    queryFn: () => userService.getAll(),
    staleTime: 300_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: consentsKey.all });

  const userLabel = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return (id?: string) => {
      const u = byId.get(id ?? "");
      return u ? { name: `${u.firstName} ${u.lastName}`, email: u.email } : { name: id ? `User ${id.slice(0, 8)}` : "—", email: "" };
    };
  }, [users]);

  const filtered = useMemo(() => {
    if (!searchTerm) return consents;
    const q = searchTerm.toLowerCase();
    return consents.filter((c) => {
      const u = userLabel(c.userId);
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (c.purpose || "").toLowerCase().includes(q);
    });
  }, [consents, searchTerm, userLabel]);

  const granted = consents.filter(isActive).length;
  const withdrawn = consents.length - granted;
  const totalPages = Math.max(1, Math.ceil(total / CONSENT_PAGE_SIZE));

  const columns = useMemo<ColumnDef<ConsentRecordDto, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Data subject",
        enableSorting: false,
        cell: ({ row }) => {
          const u = userLabel(row.original.userId);
          return (
            <div className="min-w-0 max-w-56">
              <p className="truncate font-semibold text-foreground">{u.name}</p>
              {u.email ? <p className="truncate text-xs text-faint-fg">{u.email}</p> : null}
            </div>
          );
        },
      },
      {
        id: "purpose",
        header: "Purpose",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            {purposeLabel(row.original.purpose)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) =>
          isActive(row.original) ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> Granted
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-danger">
              <XCircle className="h-3.5 w-3.5" /> Withdrawn
            </span>
          ),
      },
      {
        accessorKey: "grantedAt",
        header: "Granted",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.grantedAt)}</span>,
      },
      {
        accessorKey: "revokedAt",
        header: "Withdrawn",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.revokedAt)}</span>,
      },
    ],
    [userLabel],
  );

  return (
    <ListPageTemplate
      title="Data processing consent"
      subtitle={
        isLoading
          ? "Loading consent records…"
          : `${total} record${total === 1 ? "" : "s"} · this page: ${granted} granted · ${withdrawn} withdrawn`
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Search by person or purpose…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="space-y-4">
        <MyConsentCard onChanged={() => void invalidate()} />

        {/*
          This page was already right not to show an empty table on failure.
          What it got wrong was the diagnosis: it blamed the user's permissions
          for every failure, including a 500 or a dropped connection, and gave
          them nothing to press. Permission is now distinguished from breakage,
          and breakage can be retried.
        */}
        {error && isConsentForbidden(error) ? (
          <Alert tone="warn" title="You don't have permission to view the consent ledger">
            Viewing it needs VIEW_COMPLIANCE or MANAGE_COMPLIANCE. Ask an administrator to grant it.
          </Alert>
        ) : error ? (
          <DataErrorState
            what="the consent ledger"
            error={error}
            onRetry={refetch}
            isRetrying={isFetching}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            pageInfo={{ page, size: CONSENT_PAGE_SIZE, totalElements: total, totalPages }}
            onPageChange={setPage}
            emptyTitle="No consent records"
            emptyDescription="Consents granted or withdrawn by people in your organisation appear here, per processing purpose."
          />
        )}
      </div>
    </ListPageTemplate>
  );
}
