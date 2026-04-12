"use client";

import { useState, useEffect } from "react";
import { OrgSsoConfig, SsoOAuth2Dto, SsoSamlDto } from "@/types";
import { orgSsoService } from "@/services/orgSsoService";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { KeyRound, Shield, ToggleLeft, ToggleRight } from "lucide-react";

type TabType = "oauth2" | "saml";

export default function SsoConfigurationPage() {
    const [config, setConfig] = useState<OrgSsoConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("oauth2");
    const [isToggling, setIsToggling] = useState(false);
    const orgId = getOrganisationIdFromStorage() || "";

    const oauth2Form = useForm<SsoOAuth2Dto>();
    const samlForm = useForm<SsoSamlDto>();

    const loadConfig = async () => {
        if (!orgId) { setIsLoading(false); return; }
        try {
            setIsLoading(true);
            const data = await orgSsoService.get(orgId);
            setConfig(data);
            if (data) {
                oauth2Form.reset({
                    provider: data.provider || "GOOGLE",
                    clientId: data.clientId || "",
                    clientSecret: "",
                    issuerUri: data.issuerUri || "",
                    scopes: data.scopes || [],
                    redirectUri: data.redirectUri || "",
                });
                samlForm.reset({
                    provider: "SAML",
                    idpMetadataUrl: data.idpMetadataUrl || "",
                    spEntityId: data.spEntityId || "",
                    assertionConsumerServiceUrl: data.assertionConsumerServiceUrl || "",
                });
            }
        } catch {
            toast.error("Failed to load SSO configuration");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadConfig(); }, []);

    const handleToggle = async () => {
        if (!orgId || !config) return;
        setIsToggling(true);
        try {
            const updated = await orgSsoService.toggle(orgId, { enabled: !config.enabled });
            setConfig(updated);
            toast.success(`SSO ${updated.enabled ? "enabled" : "disabled"}`);
        } catch {
            toast.error("Failed to toggle SSO");
        } finally {
            setIsToggling(false);
        }
    };

    const onSubmitOAuth2 = async (data: SsoOAuth2Dto) => {
        if (!orgId) return;
        try {
            const updated = await orgSsoService.configureOAuth2(orgId, data);
            setConfig(updated);
            toast.success("OAuth2 SSO configured");
        } catch {
            toast.error("Failed to configure OAuth2 SSO");
        }
    };

    const onSubmitSaml = async (data: SsoSamlDto) => {
        if (!orgId) return;
        try {
            const updated = await orgSsoService.configureSaml(orgId, data);
            setConfig(updated);
            toast.success("SAML SSO configured");
        } catch {
            toast.error("Failed to configure SAML SSO");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <PageSpinner />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <Shield className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">Organisation not found. Please log in again.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">SSO Configuration</h1>
                    <p className="text-slate-500">Configure Single Sign-On for your organisation.</p>
                </div>
            </div>

            {/* Status card */}
            <Card className={`border-2 ${config?.enabled ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config?.enabled ? "bg-emerald-100" : "bg-slate-100"}`}>
                            <KeyRound className={`h-5 w-5 ${config?.enabled ? "text-emerald-600" : "text-slate-400"}`} />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">
                                SSO is {config?.enabled ? "enabled" : config ? "disabled" : "not configured"}
                            </p>
                            {config?.provider && (
                                <p className="text-sm text-slate-500">Provider: {config.provider}</p>
                            )}
                        </div>
                    </div>
                    {config && (
                        <Button
                            variant="outline"
                            onClick={handleToggle}
                            isLoading={isToggling}
                            className={config.enabled ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}
                        >
                            {config.enabled
                                ? <><ToggleRight className="h-4 w-4 mr-2" /> Disable SSO</>
                                : <><ToggleLeft className="h-4 w-4 mr-2" /> Enable SSO</>
                            }
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Configuration tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                {(["oauth2", "saml"] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                        {tab === "oauth2" ? "OAuth2 / OIDC" : "SAML 2.0"}
                    </button>
                ))}
            </div>

            {activeTab === "oauth2" && (
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle>OAuth2 / OIDC Configuration</CardTitle>
                        <CardDescription>Connect an identity provider using OpenID Connect (Google, Microsoft, Okta, etc.)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={oauth2Form.handleSubmit(onSubmitOAuth2)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="oauth-provider">Provider</Label>
                                <Select id="oauth-provider" {...oauth2Form.register("provider", { required: true })}>
                                    {["GOOGLE", "AZURE_AD", "OKTA", "GITHUB", "CUSTOM_OAUTH2"].map(p => (
                                        <option key={p} value={p}>{p.replace("_", " ")}</option>
                                    ))}
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="clientId">Client ID <span className="text-red-500">*</span></Label>
                                    <Input id="clientId" placeholder="your-client-id" {...oauth2Form.register("clientId", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientSecret">Client Secret {!config && <span className="text-red-500">*</span>}</Label>
                                    <Input id="clientSecret" type="password" placeholder={config ? "Leave blank to keep existing" : "Enter client secret"} {...oauth2Form.register("clientSecret", { required: !config })} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="issuerUri">Issuer URI <span className="text-red-500">*</span></Label>
                                <Input id="issuerUri" placeholder="https://accounts.google.com" {...oauth2Form.register("issuerUri", { required: true })} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="redirectUri">Redirect URI</Label>
                                <Input id="redirectUri" placeholder="https://yourapp.com/auth/callback" {...oauth2Form.register("redirectUri")} />
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button type="submit" isLoading={oauth2Form.formState.isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                                    Save OAuth2 Config
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {activeTab === "saml" && (
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle>SAML 2.0 Configuration</CardTitle>
                        <CardDescription>Connect an enterprise identity provider using SAML 2.0.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={samlForm.handleSubmit(onSubmitSaml)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="saml-provider">Provider Name</Label>
                                <Input id="saml-provider" placeholder="e.g. Okta SAML" {...samlForm.register("provider", { required: true })} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="idpMetadataUrl">IdP Metadata URL <span className="text-red-500">*</span></Label>
                                <Input id="idpMetadataUrl" placeholder="https://idp.company.com/metadata" {...samlForm.register("idpMetadataUrl", { required: true })} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="spEntityId">SP Entity ID <span className="text-red-500">*</span></Label>
                                <Input id="spEntityId" placeholder="https://yourapp.com" {...samlForm.register("spEntityId", { required: true })} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="acsUrl">Assertion Consumer Service URL <span className="text-red-500">*</span></Label>
                                <Input id="acsUrl" placeholder="https://yourapp.com/saml/acs" {...samlForm.register("assertionConsumerServiceUrl", { required: true })} />
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button type="submit" isLoading={samlForm.formState.isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                                    Save SAML Config
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
