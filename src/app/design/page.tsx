"use client";

/**
 * Design-system sandbox — every primitive, pattern, and signature element in
 * every state, on one page. This is the review surface for the redesign:
 * if it looks right here in both themes, it looks right everywhere.
 *
 * Public route (no auth) so it can be checked without a backend running.
 */

import * as React from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTag } from "@/components/ui/asset-tag";
import { LifecycleTrail } from "@/components/ui/lifecycle-trail";
import { AuditSeal } from "@/components/ui/audit-seal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/patterns/EmptyState";
import { FormSection } from "@/components/patterns/FormSection";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";

interface DemoAsset {
  name: string;
  tag: string;
  department: string;
  location: string;
  value: string;
  status: string;
  verified: boolean;
}

const DEMO_ASSETS: DemoAsset[] = [
  { name: "Dell Latitude 5540", tag: "ACB-IT-00412", department: "IT Operations", location: "Head Office, Accra", value: "GHS 18,400", status: "IN_USE", verified: true },
  { name: "Toyota Hilux 2.8", tag: "ACB-FL-00087", department: "Fleet", location: "Kumasi Branch", value: "GHS 612,000", status: "IN_USE", verified: true },
  { name: "Diebold CS 280 ATM", tag: "ACB-ATM-0034", department: "Channels", location: "Tema Mall", value: "GHS 890,500", status: "MAINTENANCE", verified: true },
  { name: "Cisco Catalyst 9300", tag: "ACB-NW-00156", department: "Network", location: "DC East", value: "GHS 96,200", status: "IN_USE", verified: false },
  { name: "HP LaserJet M507", tag: "ACB-IT-00298", department: "Branch Ops", location: "Takoradi", value: "GHS 9,800", status: "IN_STOCK", verified: false },
  { name: "Lenovo ThinkPad T14", tag: "ACB-IT-00521", department: "Treasury", location: "Head Office, Accra", value: "GHS 21,150", status: "MISSING", verified: false },
  { name: "CAT 100kVA Generator", tag: "ACB-FM-00012", department: "Facilities", location: "Kumasi Branch", value: "GHS 245,000", status: "UNDER_REPAIR", verified: true },
];

const columns: ColumnDef<DemoAsset, unknown>[] = [
  { accessorKey: "name", header: "Asset", cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
  { accessorKey: "tag", header: "Tag", cell: ({ row }) => <AssetTag tag={row.original.tag} /> },
  { id: "lifecycle", header: "Lifecycle", enableSorting: false, cell: ({ row }) => <LifecycleTrail status={row.original.status} /> },
  { accessorKey: "department", header: "Department", cell: ({ row }) => <span className="text-muted-fg">{row.original.department}</span> },
  { accessorKey: "value", header: () => <span className="block text-right">Book value</span>, cell: ({ row }) => <span className="data-mono block text-right">{row.original.value}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "audit", header: "Audit", enableSorting: false, cell: ({ row }) => <AuditSeal verified={row.original.verified} /> },
];

const ASSET_STATUSES = ["PENDING_PROCUREMENT", "IN_STOCK", "RESERVED", "IN_USE", "MAINTENANCE", "UNDER_REPAIR", "RETIRED", "DISPOSED", "MISSING"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-edge pb-1.5 text-sm font-bold uppercase tracking-[0.08em] text-muted-fg">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSandboxPage() {
  const [tableLoading, setTableLoading] = React.useState(false);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Design system"
            subtitle="Every primitive and pattern, in every state — the review surface for the redesign."
          />
          <ThemeToggle />
        </div>

        <Section title="Signature elements">
          <div className="flex flex-wrap items-center gap-6">
            <AssetTag tag="ACB-IT-00412" />
            <LifecycleTrail status="IN_USE" />
            <LifecycleTrail status="UNDER_REPAIR" />
            <LifecycleTrail status="MISSING" />
            <AuditSeal verified title="Verified in Q2 2026 audit" />
            <AuditSeal verified={false} />
            <span className="data-mono">GHS 1,893,050</span>
          </div>
        </Section>

        <Section title="Status badges (backend AssetStatus + generics)">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ASSET_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
            <StatusBadge status="ONBOARDING" />
            <StatusBadge status="TERMINATED" />
            <StatusBadge status="OVERDUE" />
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Add asset</Button>
            <Button variant="secondary">Export</Button>
            <Button variant="outline">Columns</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete asset</Button>
            <Button variant="link">View history</Button>
            <Button isLoading>Saving…</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm" variant="outline">Small</Button>
          </div>
        </Section>

        <Section title="Form controls">
          <Card>
            <CardContent className="pt-5">
              <FormSection title="Asset details" description="Identity and placement of the asset.">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-name">Asset name</Label>
                  <Input id="ds-name" placeholder="e.g. Dell Latitude 5540" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-dept">Department</Label>
                  <Select id="ds-dept" defaultValue="">
                    <option value="" disabled>Select department</option>
                    <option>IT Operations</option>
                    <option>Treasury</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ds-notes">Notes</Label>
                  <Textarea id="ds-notes" placeholder="Condition, warranty, remarks…" />
                </div>
              </FormSection>
            </CardContent>
          </Card>
        </Section>

        <Section title="Cards, loading & empty states">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total assets</CardTitle>
                <CardDescription>Across 14 locations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="data-mono text-2xl font-bold">4,821</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Loading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-2 pt-1 text-muted-fg"><Spinner size="sm" /> <span className="text-xs">Fetching…</span></div>
              </CardContent>
            </Card>
            <Card>
              <EmptyState
                title="No disposals yet"
                description="Assets you dispose of will be recorded here."
                action={<Button size="sm">Record disposal</Button>}
              />
            </Card>
          </div>
        </Section>

        <Section title="The register (ListPageTemplate + DataTable)">
          <ListPageTemplate
            title="Asset register"
            subtitle="4,821 assets · GHS 42.6M book value · last audit 12 Jun 2026"
            actions={
              <>
                <Button variant="outline">Export</Button>
                <Button><PackagePlus className="mr-1.5 h-4 w-4" />Add asset</Button>
              </>
            }
            toolbar={
              <>
                <Input placeholder="Search name, tag, or serial…" className="max-w-xs" />
                <Button variant="outline" size="sm">All statuses</Button>
                <Button variant="outline" size="sm">Columns</Button>
                <Button variant="ghost" size="sm" onClick={() => setTableLoading((v) => !v)}>
                  Toggle loading
                </Button>
              </>
            }
          >
            <DataTable
              columns={columns}
              data={tableLoading ? [] : DEMO_ASSETS}
              isLoading={tableLoading}
              pageInfo={{ page: 0, size: 25, totalElements: 4821, totalPages: 193 }}
              onPageChange={() => {}}
              emptyTitle="No assets found"
              emptyDescription="Try widening your filters, or add your first asset."
              footerSummary={<span>Page total · <span className="data-mono">GHS 1,893,050</span></span>}
            />
          </ListPageTemplate>
        </Section>
      </div>
    </div>
  );
}
