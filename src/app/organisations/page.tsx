"use client";

import { useEffect, useMemo, useState } from "react";
import { Organisation, OrganisationDto, OrganisationStatus, SsoConfigDto } from "@/types";
import { organisationService } from "@/services/organisationService";
import { ssoConfigService } from "@/services/ssoConfigService";
import { buildPatchPayload } from "@/lib/patch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import {
    Building2,
    Globe,
    Hash,
    Key,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Receipt,
    Search,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";

const SSO_PROVIDERS = ["OKTA", "AUTH0", "AZURE_AD", "GOOGLE", "CUSTOM"];
const STATUS_FILTERS = ["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"] as const;

const getProfileCompleteness = (org: Organisation) => {
    const fields = [
        org.industry,
        org.contactEmail,
        org.contactPhone,
        org.address,
        org.country,
        org.timezone,
        org.registrationNumber,
        org.taxId,
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
};

export default function OrganisationsPage() {
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSSOModalOpen, setIsSSOModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
    const [formData, setFormData] = useState<Partial<OrganisationDto>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");

    const [ssoFormData, setSsoFormData] = useState<Partial<SsoConfigDto>>({});
    const [isSubmittingSSO, setIsSubmittingSSO] = useState(false);

    const loadOrganisations = async () => {
        try {
            const data = await organisationService.getAll();
            setOrganisations(data);
        } catch (error) {
            toast.error("Failed to load organisations");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadOrganisations();
    }, []);

    const filteredOrganisations = useMemo(() => {
        return organisations.filter(org => {
            const matchesStatus = statusFilter === "ALL" || (org.status || "ACTIVE") === statusFilter;
            const search = searchTerm.trim().toLowerCase();
            const haystack = [
                org.name,
                org.industry,
                org.contactEmail,
                org.contactPhone,
                org.country,
                org.address,
                org.registrationNumber,
                org.taxId,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return matchesStatus && (!search || haystack.includes(search));
        });
    }, [organisations, searchTerm, statusFilter]);

    const summary = useMemo(() => {
        const active = organisations.filter(org => (org.status || "ACTIVE") === "ACTIVE").length;
        const suspended = organisations.filter(org => org.status === "SUSPENDED").length;
        const withContact = organisations.filter(org => org.contactEmail || org.contactPhone).length;
        const profileReady = organisations.filter(org => getProfileCompleteness(org) >= 75).length;

        return {
            total: organisations.length,
            active,
            suspended,
            withContact,
            profileReady,
        };
    }, [organisations]);

    const handleOpenEdit = (org: Organisation) => {
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
        setErrors({});
        setIsModalOpen(true);
    };

    const handleOpenSSO = (org: Organisation) => {
        setEditingOrg(org);
        setSsoFormData({
            provider: "CUSTOM",
            enabled: false,
        });
        setIsSSOModalOpen(true);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name?.trim()) {
            setErrors({ name: "Organisation name is required" });
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingOrg) {
                const patch = buildPatchPayload<OrganisationDto>(
                    editingOrg as unknown as Partial<OrganisationDto>,
                    formData as Partial<OrganisationDto>
                );

                if (Object.keys(patch).length === 0) {
                    toast("No changes to update");
                    return;
                }

                await organisationService.update(editingOrg.id, patch);
                toast.success("Organisation updated successfully");
            }

            await loadOrganisations();
            setIsModalOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save organisation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitSSO = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ssoFormData.clientId || !ssoFormData.clientSecret) {
            toast.error("Client ID and Secret are required to enable SSO");
            return;
        }

        setIsSubmittingSSO(true);
        try {
            await ssoConfigService.create(ssoFormData as SsoConfigDto);
            toast.success("SSO configuration saved successfully");
            setIsSSOModalOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save SSO configuration");
        } finally {
            setIsSubmittingSSO(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-56 rounded-lg bg-slate-100 animate-pulse" />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                <Card className="overflow-hidden border-0 shadow-sm">
                    <CardContent className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-6 text-white">
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,1fr)]">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                                        <Building2 className="h-5 w-5 text-cyan-300" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Organisation Directory</p>
                                        <h1 className="text-3xl font-bold tracking-tight">Organisations</h1>
                                    </div>
                                </div>
                                <p className="max-w-2xl text-sm leading-6 text-slate-300">
                                    Review tenant identity, legal information, regional settings, and SSO readiness from a cleaner
                                    single view.
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                                        {summary.total.toLocaleString()} organisation{summary.total === 1 ? "" : "s"}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                                        {filteredOrganisations.length.toLocaleString()} visible
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Active</p>
                                    <p className="mt-2 text-3xl font-black">{summary.active.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Suspended</p>
                                    <p className="mt-2 text-3xl font-black">{summary.suspended.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">With Contact</p>
                                    <p className="mt-2 text-3xl font-black">{summary.withContact.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Profile Ready</p>
                                    <p className="mt-2 text-3xl font-black">{summary.profileReady.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Browse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5">
                        <div className="space-y-2">
                            <Label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Search
                            </Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    id="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name, email, country, tax ID..."
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Status
                            </Label>
                            <Select
                                id="status-filter"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
                            >
                                {STATUS_FILTERS.map(status => (
                                    <option key={status} value={status}>
                                        {status === "ALL" ? "All statuses" : status}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Profile quality</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Cards now highlight contact, legal, and location completeness so missing tenant details are easy to spot.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {organisations.length === 0 ? (
                <Card className="border-slate-200">
                    <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <Building2 className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">No organisations found</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                Organisation records will appear here once they are available from the backend.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : filteredOrganisations.length === 0 ? (
                <Card className="border-slate-200">
                    <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                        <Search className="h-8 w-8 text-slate-300" />
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">No matching organisations</h3>
                            <p className="mt-1 text-sm text-slate-500">
                                Try a different search term or status filter.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredOrganisations.map((org) => {
                        const completeness = getProfileCompleteness(org);
                        const status = org.status || "ACTIVE";
                        const statusClasses =
                            status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : status === "SUSPENDED"
                                    ? "bg-rose-100 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200";

                        return (
                            <Card key={org.id} className="overflow-hidden border-slate-200 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                                <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-lg font-semibold text-slate-900" title={org.name}>
                                                    {org.name}
                                                </CardTitle>
                                                <p className="truncate text-sm text-slate-500">
                                                    {org.industry || "Industry not specified"}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClasses}`}>
                                            {status}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {org.country && (
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                                {org.country}
                                            </span>
                                        )}
                                        {org.timezone && (
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                                {org.timezone}
                                            </span>
                                        )}
                                        {!org.country && !org.timezone && (
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-200">
                                                Region details missing
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-5 p-5">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <p className="text-sm font-semibold text-slate-800">Profile completeness</p>
                                            <span className="text-sm font-bold text-slate-900">{completeness}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-200">
                                            <div
                                                className={`h-2 rounded-full ${completeness >= 75 ? "bg-emerald-500" : completeness >= 40 ? "bg-amber-500" : "bg-slate-400"}`}
                                                style={{ width: `${completeness}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact Email</p>
                                                <p className="truncate text-sm font-medium text-slate-800">
                                                    {org.contactEmail || "Not set"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contact Phone</p>
                                                <p className="truncate text-sm font-medium text-slate-800">
                                                    {org.contactPhone || "Not set"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Address</p>
                                                <p className="line-clamp-2 text-sm font-medium text-slate-800">
                                                    {org.address || "Not set"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Hash className="h-3.5 w-3.5" />
                                                <p className="text-[11px] font-semibold uppercase tracking-wide">Registration</p>
                                            </div>
                                            <p className="mt-2 truncate font-mono text-sm text-slate-800" title={org.registrationNumber}>
                                                {org.registrationNumber || "Not set"}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Receipt className="h-3.5 w-3.5" />
                                                <p className="text-[11px] font-semibold uppercase tracking-wide">Tax ID</p>
                                            </div>
                                            <p className="mt-2 truncate font-mono text-sm text-slate-800" title={org.taxId}>
                                                {org.taxId || "Not set"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">Tenant readiness</p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {org.contactEmail || org.registrationNumber || org.taxId
                                                        ? "Core operational metadata is present for this organisation."
                                                        : "This organisation still needs contact and compliance details."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenSSO(org)}
                                            className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                        >
                                            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> SSO
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(org)} className="h-8">
                                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Edit Organisation"
                description="Update your organisation details. Changes take effect immediately."
            >
                <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
                    <div className="space-y-4">
                        <h4 className="border-b pb-1 text-sm font-semibold text-slate-900">General Information</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="name">
                                    Organisation Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="Acme Corp"
                                    value={formData.name || ""}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    placeholder="Technology, Manufacturing..."
                                    value={formData.industry || ""}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Input
                                    id="timezone"
                                    placeholder="Africa/Accra"
                                    value={formData.timezone || ""}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    id="status"
                                    value={formData.status || "ACTIVE"}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as OrganisationStatus })}
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                    <option value="SUSPENDED">SUSPENDED</option>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="border-b pb-1 text-sm font-semibold text-slate-900">Contact Details</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail">Contact Email</Label>
                                <Input
                                    id="contactEmail"
                                    type="email"
                                    placeholder="ops@acme.com"
                                    value={formData.contactEmail || ""}
                                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                <Input
                                    id="contactPhone"
                                    placeholder="+233244999999"
                                    value={formData.contactPhone || ""}
                                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Address</Label>
                                <Textarea
                                    id="address"
                                    placeholder="456 Industrial Rd, Accra"
                                    value={formData.address || ""}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    placeholder="Ghana"
                                    value={formData.country || ""}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="border-b pb-1 text-sm font-semibold text-slate-900">Legal & Tax Information</h4>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="registrationNumber">Registration Number</Label>
                                <Input
                                    id="registrationNumber"
                                    placeholder="GH-12345"
                                    value={formData.registrationNumber || ""}
                                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxId">Tax ID</Label>
                                <Input
                                    id="taxId"
                                    placeholder="TID-9876"
                                    value={formData.taxId || ""}
                                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white/90 pb-2 pt-4 backdrop-blur">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isSSOModalOpen}
                onClose={() => setIsSSOModalOpen(false)}
                title={`SSO Configuration — ${editingOrg?.name}`}
                description="Configure an OAuth2 / OIDC Identity Provider for single sign-on."
            >
                <form onSubmit={onSubmitSSO} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="provider">
                                Provider <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                id="provider"
                                value={ssoFormData.provider || "CUSTOM"}
                                onChange={(e) => setSsoFormData({ ...ssoFormData, provider: e.target.value as any })}
                            >
                                {SSO_PROVIDERS.map(provider => (
                                    <option key={provider} value={provider}>
                                        {provider}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex items-center space-y-2 pt-6">
                            <input
                                type="checkbox"
                                id="enabled"
                                checked={ssoFormData.enabled || false}
                                onChange={(e) => setSsoFormData({ ...ssoFormData, enabled: e.target.checked })}
                                className="mr-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <Label htmlFor="enabled">Enable SSO</Label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="discoveryUrl">
                            <Globe className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                            Discovery URL (Issuer)
                        </Label>
                        <Input
                            id="discoveryUrl"
                            placeholder="https://accounts.google.com/.well-known/openid-configuration"
                            value={ssoFormData.discoveryUrl || ""}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, discoveryUrl: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clientId">
                            Client ID <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="clientId"
                            placeholder="your-oauth-client-id"
                            value={ssoFormData.clientId || ""}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, clientId: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clientSecret">
                            Client Secret <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                id="clientSecret"
                                type="password"
                                placeholder="Enter client secret (never returned by API)"
                                value={ssoFormData.clientSecret || ""}
                                onChange={(e) => setSsoFormData({ ...ssoFormData, clientSecret: e.target.value })}
                            />
                            <Key className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <p className="text-[10px] text-slate-500">
                            Client secrets are <b>never returned</b> by the API for security. Always enter a value when saving.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="redirectUri">Redirect URI</Label>
                        <Input
                            id="redirectUri"
                            placeholder="https://myapp.com/auth/callback"
                            value={ssoFormData.redirectUri || ""}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, redirectUri: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsSSOModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmittingSSO} className="bg-amber-600 hover:bg-amber-700">
                            Save SSO Config
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
