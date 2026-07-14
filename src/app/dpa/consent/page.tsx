"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Plus, XCircle, CheckCircle2, HelpCircle, Search } from "lucide-react";
import { dpaConsentService, type ConsentRecordDto, type ConsentPurpose } from "@/services/dpaConsentService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/useConfirm";

const PURPOSES: { value: ConsentPurpose; label: string }[] = [
  { value: "MARKETING", label: "Marketing" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "DATA_SHARING", label: "Data sharing" },
  { value: "PROFILING", label: "Profiling" },
  { value: "THIRD_PARTY", label: "Third party" },
  { value: "COMMUNICATIONS", label: "Communications" },
  { value: "OTHER", label: "Other" },
];

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function ConsentChecker() {
  const [subjectId, setSubjectId] = useState("");
  const [purpose, setPurpose] = useState<ConsentPurpose>("MARKETING");
  const [result, setResult] = useState<{ granted: boolean; expiresAt?: string } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async () => {
    if (!subjectId.trim()) {
      toast.error("Subject ID is required");
      return;
    }
    setIsChecking(true);
    try {
      setResult(await dpaConsentService.check(subjectId, purpose));
    } catch {
      toast.error("Consent check failed");
      setResult(null);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-brand" /> Check consent status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-end gap-3 sm:flex-row">
          <div className="w-full flex-1 space-y-1.5">
            <Label htmlFor="chk-subject">Subject ID</Label>
            <Input
              id="chk-subject"
              placeholder="User or subject ID…"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="chk-purpose">Purpose</Label>
            <Select
              id="chk-purpose"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value as ConsentPurpose);
                setResult(null);
              }}
              className="w-44"
            >
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <Button onClick={handleCheck} isLoading={isChecking}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Check
          </Button>
        </div>
        {result !== null && (
          <div
            className={`mt-4 flex items-center gap-3 rounded-card border p-3 ${
              result.granted ? "border-ok/40 bg-ok-soft" : "border-danger/40 bg-danger-soft"
            }`}
          >
            {result.granted ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-danger" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                Consent {result.granted ? "granted" : "not granted"} for {purpose}
              </p>
              {result.expiresAt && <p className="mt-0.5 text-xs text-muted-fg">Expires: {fmt(result.expiresAt)}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FormData = Omit<ConsentRecordDto, "id" | "organisationId" | "createdAt" | "revokedAt">;

export default function DpaConsentPage() {
  const queryClient = useQueryClient();
  const consentsKey = qk.module("dpa-consent");
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: consents = [], isLoading } = useQuery({
    queryKey: consentsKey.list(),
    queryFn: () => dpaConsentService.listAll(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: consentsKey.all });

  const recordConsent = useMutation({
    mutationFn: (data: FormData) => dpaConsentService.record(data),
    onSuccess: () => {
      toast.success("Consent recorded");
      invalidate();
    },
    onError: () => toast.error("Failed to record consent"),
  });
  const revokeConsent = useMutation({
    mutationFn: ({ purpose, subjectId }: { purpose: ConsentPurpose; subjectId: string }) =>
      dpaConsentService.revoke(purpose, subjectId),
    onSuccess: () => {
      toast.success("Consent revoked");
      invalidate();
    },
    onError: () => toast.error("Failed to revoke consent"),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset({
      subjectId: "",
      subjectEmail: "",
      subjectName: "",
      purpose: "MARKETING",
      granted: true,
      consentText: "",
      expiresAt: "",
      ipAddress: "",
      userAgent: "",
    });
  }, [isModalOpen, reset]);

  const filtered = useMemo(() => {
    if (!searchTerm) return consents;
    const q = searchTerm.toLowerCase();
    return consents.filter(
      (c) =>
        (c.subjectEmail || "").toLowerCase().includes(q) ||
        (c.subjectName || "").toLowerCase().includes(q) ||
        (c.purpose || "").toLowerCase().includes(q),
    );
  }, [consents, searchTerm]);

  const granted = consents.filter((c) => c.granted).length;
  const revoked = consents.filter((c) => !c.granted || c.revokedAt).length;

  const onSubmit = async (data: FormData) => {
    await recordConsent.mutateAsync(data);
    setIsModalOpen(false);
  };

  const handleRevoke = async (consent: ConsentRecordDto) => {
    if (!consent.purpose || !consent.subjectId) return;
    if (
      !(await confirm({
        message: `Revoke ${consent.purpose} consent for ${consent.subjectEmail || consent.subjectId}?`,
        variant: "warning",
      }))
    )
      return;
    revokeConsent.mutate({ purpose: consent.purpose as ConsentPurpose, subjectId: consent.subjectId });
  };

  const columns = useMemo<ColumnDef<ConsentRecordDto, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Subject",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">
              {row.original.subjectName || row.original.subjectEmail || row.original.subjectId || "—"}
            </p>
            {row.original.subjectEmail ? <p className="truncate text-xs text-faint-fg">{row.original.subjectEmail}</p> : null}
          </div>
        ),
      },
      {
        id: "purpose",
        header: "Purpose",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            {PURPOSES.find((p) => p.value === row.original.purpose)?.label || row.original.purpose || "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.granted ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> Granted
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-danger">
              <XCircle className="h-3.5 w-3.5" /> Denied
            </span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Recorded",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.createdAt)}</span>,
      },
      {
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.expiresAt)}</span>,
      },
      {
        accessorKey: "revokedAt",
        header: "Revoked",
        cell: ({ row }) => <span className="text-muted-fg">{fmt(row.original.revokedAt)}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.granted && !row.original.revokedAt ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-danger"
              onClick={() => handleRevoke(row.original)}
            >
              <XCircle className="h-3.5 w-3.5" /> Revoke
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ListPageTemplate
      title="Data processing consent"
      subtitle={isLoading ? "Loading consent records…" : `${consents.length} records · ${granted} granted · ${revoked} revoked or denied`}
      actions={
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record consent
        </Button>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input
            placeholder="Search by subject or purpose…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="space-y-4">
        <ConsentChecker />

        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          emptyTitle="No consent records"
          emptyDescription="GDPR/Ghana DPA compliance — track data subject consent per processing purpose."
          emptyAction={
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Record consent
            </Button>
          }
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record consent"
        description="Document a data subject's consent for a specific processing purpose."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Subject name</Label>
              <Input id="c-name" placeholder="Full name…" {...register("subjectName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Subject email</Label>
              <Input id="c-email" type="email" placeholder="email@example.com" {...register("subjectEmail")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-sid">Subject ID <span className="text-danger">*</span></Label>
            <Input id="c-sid" placeholder="Internal user/subject ID" {...register("subjectId", { required: "Subject ID is required" })} />
            {errors.subjectId && <p className="text-sm text-danger">{errors.subjectId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-purpose">Purpose <span className="text-danger">*</span></Label>
            <Select id="c-purpose" {...register("purpose", { required: "Purpose is required" })}>
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="c-granted"
              defaultChecked
              className="ea-focus rounded border-edge accent-[var(--primary)]"
              {...register("granted")}
            />
            <Label htmlFor="c-granted" className="cursor-pointer">Consent granted (uncheck to record a denial)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-text">Consent text / statement</Label>
            <Textarea id="c-text" placeholder="The exact wording shown to the subject…" {...register("consentText")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-expires">Expiry date</Label>
            <Input id="c-expires" type="date" {...register("expiresAt")} />
          </div>
          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={recordConsent.isPending}>
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Record consent
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
