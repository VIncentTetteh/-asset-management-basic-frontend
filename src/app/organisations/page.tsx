"use client";

import { useState, useEffect } from "react";
import { Organisation, OrganisationDto, OrganisationStatus, SsoConfigDto } from "@/types";
import { organisationService } from "@/services/organisationService";
import { ssoConfigService } from "@/services/ssoConfigService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Pencil, Building2, ShieldCheck, Key, Globe, Phone, Mail, MapPin, Hash, Clock, Receipt } from "lucide-react";

const SSO_PROVIDERS = ["OKTA", "AUTH0", "AZURE_AD", "GOOGLE", "CUSTOM"];

export default function OrganisationsPage() {
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSSOModalOpen, setIsSSOModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
    const [formData, setFormData] = useState<Partial<OrganisationDto>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // SSO Config state
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
        loadOrganisations();
    }, []);

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

    const handleOpenSSO = async (org: Organisation) => {
        setEditingOrg(org);
        setSsoFormData({
            provider: "CUSTOM",
            enabled: false,
        });

        // Try to load existing config
        try {
            // NOTE: In a real app, there would be a getSsoConfig endpoint
            // For now we'll just open the modal with defaults
        } catch (error) {
            console.error("Failed to load SSO config:", error);
        }

        setIsSSOModalOpen(true);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.name?.trim()) {
            setErrors({ name: "Organisation name is required" });
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingOrg) {
                await organisationService.update(editingOrg.id, formData as OrganisationDto);
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
        return <div className="p-8 text-center text-slate-500">Loading organisations...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organisations</h1>
                    <p className="text-slate-500">Manage tenants and their settings</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organisations.length === 0 ? (
                    <div className="col-span-full p-12 text-center bg-slate-50 border border-slate-200 rounded-xl border-dashed">
                        <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No organisations</h3>
                        <p className="text-slate-500 mt-1">Get started by creating a new organisation.</p>
                    </div>
                ) : (
                    organisations.map((org) => (
                        <Card key={org.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200 flex flex-col h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base font-semibold text-slate-900 truncate" title={org.name}>
                                            {org.name}
                                        </CardTitle>
                                        {org.industry && <p className="text-xs text-slate-500 truncate">{org.industry}</p>}
                                    </div>
                                </div>
                                <div className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ml-2 ${org.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                    org.status === "SUSPENDED" ? "bg-red-100 text-red-700 border-red-200" :
                                        "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}>
                                    {org.status || "ACTIVE"}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col">
                                <div className="p-4 space-y-5 text-sm text-slate-600 flex-1">
                                    {/* Empty State */}
                                    {!org.contactEmail && !org.contactPhone && !org.address && !org.country && !org.timezone && !org.registrationNumber && !org.taxId && (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-4">
                                            <p className="text-xs italic">No additional details provided.</p>
                                        </div>
                                    )}

                                    {/* Contact Section */}
                                    {(org.contactEmail || org.contactPhone) && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact</h4>
                                            {org.contactEmail && (
                                                <div className="flex items-center gap-2 truncate text-slate-700">
                                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{org.contactEmail}</span>
                                                </div>
                                            )}
                                            {org.contactPhone && (
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span>{org.contactPhone}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Location Section */}
                                    {(org.address || org.country || org.timezone) && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location & Time</h4>
                                            {(org.address || org.country) && (
                                                <div className="flex gap-2 text-slate-700 items-start">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2 leading-tight">
                                                        {[org.address, org.country].filter(Boolean).join(", ")}
                                                    </span>
                                                </div>
                                            )}
                                            {org.timezone && (
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="text-xs font-medium">{org.timezone}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Business & Legal Section */}
                                    {(org.registrationNumber || org.taxId) && (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legal</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {org.registrationNumber && (
                                                    <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                        <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <span className="text-xs font-mono truncate" title={org.registrationNumber}>{org.registrationNumber}</span>
                                                    </div>
                                                )}
                                                {org.taxId && (
                                                    <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                                                        <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <span className="text-xs font-mono truncate" title={org.taxId}>{org.taxId}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-slate-50/50 mt-auto border-t border-slate-100">
                                    <div className="flex justify-end gap-2 transition-opacity">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenSSO(org)} className="h-8 text-amber-600 hover:text-amber-700 border-amber-200 hover:bg-amber-50">
                                            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> SSO
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(org)} className="h-8">
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* ─── Edit Organisation Modal ─────────────────────────────────────── */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Edit Organisation"
                description="Update your organisation details. Changes take effect immediately."
            >
                <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">General Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="name">Organisation Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    placeholder="Acme Corp"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    placeholder="Technology, Manufacturing..."
                                    value={formData.industry || ''}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Input
                                    id="timezone"
                                    placeholder="Africa/Accra"
                                    value={formData.timezone || ''}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    id="status"
                                    value={formData.status || 'ACTIVE'}
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
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Contact Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail">Contact Email</Label>
                                <Input
                                    id="contactEmail"
                                    type="email"
                                    placeholder="ops@acme.com"
                                    value={formData.contactEmail || ''}
                                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                <Input
                                    id="contactPhone"
                                    placeholder="+233244999999"
                                    value={formData.contactPhone || ''}
                                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    placeholder="456 Industrial Rd, Accra"
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    placeholder="Ghana"
                                    value={formData.country || ''}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-1">Legal & Tax Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="registrationNumber">Registration Number</Label>
                                <Input
                                    id="registrationNumber"
                                    placeholder="GH-12345"
                                    value={formData.registrationNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxId">Tax ID</Label>
                                <Input
                                    id="taxId"
                                    placeholder="TID-9876"
                                    value={formData.taxId || ''}
                                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-white/90 backdrop-blur pb-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ─── SSO Config Modal ────────────────────────────────────────────── */}
            <Modal
                isOpen={isSSOModalOpen}
                onClose={() => setIsSSOModalOpen(false)}
                title={`SSO Configuration — ${editingOrg?.name}`}
                description="Configure an OAuth2 / OIDC Identity Provider for single sign-on."
            >
                <form onSubmit={onSubmitSSO} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="provider">Provider <span className="text-red-500">*</span></Label>
                            <Select
                                id="provider"
                                value={ssoFormData.provider || 'CUSTOM'}
                                onChange={(e) => setSsoFormData({ ...ssoFormData, provider: e.target.value as any })}
                            >
                                {SSO_PROVIDERS.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2 flex items-center pt-6">
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
                            <Globe className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                            Discovery URL (Issuer)
                        </Label>
                        <Input
                            id="discoveryUrl"
                            placeholder="https://accounts.google.com/.well-known/openid-configuration"
                            value={ssoFormData.discoveryUrl || ''}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, discoveryUrl: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clientId">Client ID <span className="text-red-500">*</span></Label>
                        <Input
                            id="clientId"
                            placeholder="your-oauth-client-id"
                            value={ssoFormData.clientId || ''}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, clientId: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clientSecret">Client Secret <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input
                                id="clientSecret"
                                type="password"
                                placeholder="Enter client secret (never returned by API)"
                                value={ssoFormData.clientSecret || ''}
                                onChange={(e) => setSsoFormData({ ...ssoFormData, clientSecret: e.target.value })}
                            />
                            <Key className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        <p className="text-[10px] text-slate-500">Client secrets are <b>never returned</b> by the API for security. Always enter a value when saving.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="redirectUri">Redirect URI</Label>
                        <Input
                            id="redirectUri"
                            placeholder="https://myapp.com/auth/callback"
                            value={ssoFormData.redirectUri || ''}
                            onChange={(e) => setSsoFormData({ ...ssoFormData, redirectUri: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsSSOModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmittingSSO} className="bg-amber-600 hover:bg-amber-700">
                            Save SSO Config
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
