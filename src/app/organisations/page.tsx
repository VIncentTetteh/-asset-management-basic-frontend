"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, Globe, Key, Pencil, ShieldCheck, Search } from "lucide-react";
import type { Organisation, OrganisationDto, OrganisationStatus, SsoConfigDto } from "@/types";
import { organisationService } from "@/services/organisationService";
import { orgSsoService } from "@/services/orgSsoService";
import { qk } from "@/lib/queryClient";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { countryName } from "@/lib/countries";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildPatchPayload } from "@/lib/patch";

const SSO_PROVIDERS = ["OKTA", "AUTH0", "AZURE_AD", "GOOGLE", "CUSTOM"];

const getProfileCompleteness = (org: Organisation) => {
  const fields = [org.industry, org.contactEmail, org.contactPhone, org.address, org.country, org.timezone, org.registrationNumber, org.taxId];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

export default function OrganisationsPage() {
  const queryClient = useQueryClient();
  const orgsKey = qk.module("organisations");

  const { data: organisations = [], isLoading } = useQuery({
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
    onError: (error) => {
      const message = (error as { message?: string })?.message ?? "Failed to save organisation";
      toast.error(message);
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSSOModalOpen, setIsSSOModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [formData, setFormData] = useState<Partial<OrganisationDto>>({});
  const [nameError, setNameError] = useState<string | null>(null);
  const [ssoFormData, setSsoFormData] = useState<Partial<SsoConfigDto>>({});
  const [isSubmittingSSO, setIsSubmittingSSO] = useState(false);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return organisations;
    return organisations.filter((org) =>
      [org.name, org.industry, org.contactEmail, org.country].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [organisations, searchTerm]);

  const openEdit = (org: Organisation) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      industry: org.industry,
      status: org.status as OrganisationStatus,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      address: org.address,
      country: org.country,
      timezone: org.timezone,
      registrationNumber: org.registrationNumber,
      taxId: org.taxId,
    });
    setNameError(null);
    setIsModalOpen(true);
  };

  const openSSO = async (org: Organisation) => {
    setEditingOrg(org);
    setSsoFormData({ provider: "CUSTOM", enabled: false });
    setIsSSOModalOpen(true);
    try {
      const config = await orgSsoService.get(org.id);
      if (config) {
        setSsoFormData({
          provider: config.provider || "CUSTOM",
          enabled: config.enabled,
          clientId: config.clientId || "",
          discoveryUrl: config.issuerUri || "",
          redirectUri: config.redirectUri || "",
          clientSecret: "",
        });
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      toast.error(status === 403 ? "You need admin or security permission to manage SSO." : "Failed to load SSO configuration");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setNameError("Organisation name is required");
      return;
    }
    if (!editingOrg) return;
    const patch = buildPatchPayload<OrganisationDto>(editingOrg as unknown as Partial<OrganisationDto>, formData as Partial<OrganisationDto>);
    if (Object.keys(patch).length === 0) {
      toast("No changes to update");
      return;
    }
    await saveOrg.mutateAsync({ id: editingOrg.id, data: patch });
    setIsModalOpen(false);
  };

  const onSubmitSSO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) {
      toast.error("Choose an organisation before saving SSO");
      return;
    }
    if (!ssoFormData.clientId || !ssoFormData.clientSecret || !ssoFormData.discoveryUrl) {
      toast.error("Issuer URL, client ID, and client secret are required to save OAuth2 SSO");
      return;
    }
    setIsSubmittingSSO(true);
    try {
      await orgSsoService.configureOAuth2(editingOrg.id, {
        provider: ssoFormData.provider || "CUSTOM",
        clientId: ssoFormData.clientId,
        clientSecret: ssoFormData.clientSecret,
        issuerUri: ssoFormData.discoveryUrl,
        scopes: ["openid", "email", "profile"],
        redirectUri: ssoFormData.redirectUri || null,
      });
      await orgSsoService.toggle(editingOrg.id, { enabled: Boolean(ssoFormData.enabled) });
      toast.success("SSO configuration saved");
      setIsSSOModalOpen(false);
    } catch (error) {
      toast.error((error as { message?: string })?.message || "Failed to save SSO configuration");
    } finally {
      setIsSubmittingSSO(false);
    }
  };

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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="SSO configuration"
              aria-label="Configure SSO"
              onClick={() => openSSO(row.original)}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
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
        emptyTitle="No organisations found"
        emptyDescription="Tenant organisations appear here once registered."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Edit ${editingOrg?.name ?? "organisation"}`}
        description="Organisation profile, contact, and legal information."
      >
        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-6 overflow-y-auto px-1">
          <div className="space-y-4">
            <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Profile</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name <span className="text-danger">*</span></Label>
                <Input id="org-name" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                {nameError && <p className="text-sm text-danger">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-industry">Industry</Label>
                <Input id="org-industry" value={formData.industry || ""} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-status">Status</Label>
                <Select
                  id="org-status"
                  value={formData.status || "ACTIVE"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OrganisationStatus })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-timezone">Timezone</Label>
                <Input id="org-timezone" placeholder="Africa/Accra" value={formData.timezone || ""} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Contact</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-email">Contact email</Label>
                <Input id="org-email" type="email" value={formData.contactEmail || ""} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Contact phone</Label>
                <Input id="org-phone" placeholder="+233244999999" value={formData.contactPhone || ""} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="org-address">Address</Label>
                <Textarea id="org-address" value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-country">Country</Label>
                <CountrySelect id="org-country" value={formData.country || ""} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Legal &amp; tax</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-reg">Registration number</Label>
                <Input id="org-reg" placeholder="GH-12345" value={formData.registrationNumber || ""} onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-tax">Tax ID</Label>
                <Input id="org-tax" placeholder="TID-9876" value={formData.taxId || ""} onChange={(e) => setFormData({ ...formData, taxId: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-edge-subtle bg-surface/95 pb-2 pt-4 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={saveOrg.isPending}>Save changes</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSSOModalOpen}
        onClose={() => setIsSSOModalOpen(false)}
        title={`SSO configuration — ${editingOrg?.name ?? ""}`}
        description="Configure an OAuth2 / OIDC identity provider for single sign-on."
      >
        <form onSubmit={onSubmitSSO} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sso-provider">Provider <span className="text-danger">*</span></Label>
              <Select
                id="sso-provider"
                value={ssoFormData.provider || "CUSTOM"}
                onChange={(e) => setSsoFormData({ ...ssoFormData, provider: e.target.value })}
              >
                {SSO_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="sso-enabled"
                checked={ssoFormData.enabled || false}
                onChange={(e) => setSsoFormData({ ...ssoFormData, enabled: e.target.checked })}
                className="ea-focus rounded border-edge accent-[var(--primary)]"
              />
              <Label htmlFor="sso-enabled" className="cursor-pointer">Enable SSO</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sso-discovery">
              <Globe className="mr-1 inline h-3.5 w-3.5 text-faint-fg" />
              Discovery URL (issuer)
            </Label>
            <Input
              id="sso-discovery"
              placeholder="https://accounts.google.com/.well-known/openid-configuration"
              value={ssoFormData.discoveryUrl || ""}
              onChange={(e) => setSsoFormData({ ...ssoFormData, discoveryUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sso-client-id">Client ID <span className="text-danger">*</span></Label>
            <Input
              id="sso-client-id"
              className="data-mono"
              placeholder="your-oauth-client-id"
              value={ssoFormData.clientId || ""}
              onChange={(e) => setSsoFormData({ ...ssoFormData, clientId: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sso-secret">Client secret <span className="text-danger">*</span></Label>
            <div className="relative">
              <Input
                id="sso-secret"
                type="password"
                placeholder="Enter client secret (never returned by API)"
                value={ssoFormData.clientSecret || ""}
                onChange={(e) => setSsoFormData({ ...ssoFormData, clientSecret: e.target.value })}
              />
              <Key className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-faint-fg" />
            </div>
            <p className="text-[11px] text-faint-fg">
              Client secrets are <strong>never returned</strong> by the API for security. Always enter a value when saving.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sso-redirect">Redirect URI</Label>
            <Input
              id="sso-redirect"
              placeholder="https://myapp.com/auth/callback"
              value={ssoFormData.redirectUri || ""}
              onChange={(e) => setSsoFormData({ ...ssoFormData, redirectUri: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSSOModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmittingSSO}>Save SSO config</Button>
          </div>
        </form>
      </Modal>
    </ListPageTemplate>
  );
}
