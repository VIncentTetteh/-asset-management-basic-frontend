"use client";

import { useCallback, useState, useEffect } from "react";
import { OrgSsoConfig, SsoOAuth2Dto, SsoSamlDto } from "@/types";
import { orgSsoService } from "@/services/orgSsoService";
import { getOrganisationIdFromStorage } from "@/lib/authContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { KeyRound, Shield, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toastActionError } from "@/lib/step-up";
import { reportApiError } from "@/lib/api-validation";
import axios from "axios";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { emailDomainRule, httpUrlRule, httpsUrlRule } from "@/features/sso/ssoValidation";
import { activeSsoType, needsReplaceConfirmation, replaceWarning, type SsoType } from "@/features/sso/ssoType";

type TabType = "oauth2" | "saml";

const L = FIELD_LIMITS.ssoConfig;

export default function SsoConfigurationPage() {
    const [config, setConfig] = useState<OrgSsoConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("oauth2");
    const [isToggling, setIsToggling] = useState(false);
    // A save that would replace the other SSO type, held until the admin confirms.
    const [pendingReplace, setPendingReplace] = useState<
        { type: "oauth2"; data: SsoOAuth2Dto } | { type: "saml"; data: SsoSamlDto } | null
    >(null);
    const orgId = getOrganisationIdFromStorage() || "";

    const oauth2Form = useForm<SsoOAuth2Dto>();
    const samlForm = useForm<SsoSamlDto>();
    const o2e = oauth2Form.formState.errors;
    const se = samlForm.formState.errors;

    const loadConfig = useCallback(async () => {
        if (!orgId) { setIsLoading(false); return; }
        try {
            setIsLoading(true);
            const data = await orgSsoService.get(orgId);
            setConfig(data);
            setActiveTab(activeSsoType(data) ?? "oauth2");
            if (data) {
                oauth2Form.reset({
                    provider: data.provider || "GOOGLE",
                    clientId: data.clientId || "",
                    clientSecret: "",
                    issuerUri: data.issuerUri || "",
                    scopes: data.scopes ?? null,
                    redirectUri: data.redirectUri || "",
                    emailDomain: data.emailDomain || "",
                });
                samlForm.reset({
                    provider: "SAML",
                    idpMetadataUrl: data.idpMetadataUrl || "",
                    spEntityId: data.spEntityId || "",
                    assertionConsumerServiceUrl: data.assertionConsumerServiceUrl || "",
                    emailDomain: data.emailDomain || "",
                });
            }
        } catch (error) {
            toast.error(axios.isAxiosError(error) && error.response?.status === 403
                ? "You need admin or security permission to manage SSO."
                : "Failed to load SSO configuration");
        } finally {
            setIsLoading(false);
        }
    }, [oauth2Form, orgId, samlForm]);

    useEffect(() => { void loadConfig(); }, [loadConfig]);

    const handleToggle = async () => {
        if (!orgId || !config) return;
        setIsToggling(true);
        try {
            const updated = await orgSsoService.toggle(orgId, { enabled: !config.enabled });
            setConfig(updated);
            toast.success(`SSO ${updated.enabled ? "enabled" : "disabled"}`);
        } catch (error) {
            toastActionError(error, axios.isAxiosError(error) && error.response?.status === 403
                ? "You need admin or security permission to manage SSO."
                : "Failed to toggle SSO");
        } finally {
            setIsToggling(false);
        }
    };

    const saveOAuth2 = async (data: SsoOAuth2Dto, replaceExisting: boolean) => {
        if (!orgId) return;
        try {
            await orgSsoService.configureOAuth2(orgId, data, { replaceExisting });
            toast.success(replaceExisting ? "OAuth2 SSO configured. Enable SSO to turn it on." : "OAuth2 SSO configured");
            await loadConfig();
        } catch (error) {
            reportApiError(error, { fallback: axios.isAxiosError(error) && error.response?.status === 403
                ? "You need admin or security permission to manage SSO."
                : "Failed to configure OAuth2 SSO", setError: oauth2Form.setError });
        }
    };

    const saveSaml = async (data: SsoSamlDto, replaceExisting: boolean) => {
        if (!orgId) return;
        try {
            // SAML is a single provider value on the API (SsoProvider.SAML); a free-text
            // name like "Okta SAML" was not an enum value and failed as malformed JSON.
            await orgSsoService.configureSaml(orgId, { ...data, provider: "SAML" }, { replaceExisting });
            toast.success(replaceExisting ? "SAML SSO configured. Enable SSO to turn it on." : "SAML SSO configured");
            await loadConfig();
        } catch (error) {
            reportApiError(error, { fallback: axios.isAxiosError(error) && error.response?.status === 403
                ? "You need admin or security permission to manage SSO."
                : "Failed to configure SAML SSO", setError: samlForm.setError });
        }
    };

    // One SSO type per organisation: warn before OAuth2 and SAML replace each other.
    const onSubmitOAuth2 = async (data: SsoOAuth2Dto) => {
        if (needsReplaceConfirmation(config, "oauth2")) {
            setPendingReplace({ type: "oauth2", data });
            return;
        }
        await saveOAuth2(data, false);
    };

    const onSubmitSaml = async (data: SsoSamlDto) => {
        if (needsReplaceConfirmation(config, "saml")) {
            setPendingReplace({ type: "saml", data });
            return;
        }
        await saveSaml(data, false);
    };

    const confirmReplace = async () => {
        const pending = pendingReplace;
        setPendingReplace(null);
        if (!pending) return;
        if (pending.type === "oauth2") await saveOAuth2(pending.data, true);
        else await saveSaml(pending.data, true);
    };

    const activeType: SsoType | null = activeSsoType(config);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <PageSpinner />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="flex h-64 flex-col items-center justify-center text-center">
                <Shield className="mb-4 h-12 w-12 text-faint-fg" />
                <p className="text-muted-fg">Organisation not found. Please log in again.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <PageHeader title="SSO Configuration" subtitle="Configure Single Sign-On for your organisation." />

            <Card className={cn("border-2", config?.enabled ? "border-ok/40 bg-ok-soft/40" : undefined)}>
                <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("rounded-control p-2", config?.enabled ? "bg-ok-soft" : "bg-surface-muted")}>
                            <KeyRound className={cn("h-5 w-5", config?.enabled ? "text-ok" : "text-faint-fg")} />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">
                                SSO is {config?.enabled ? "enabled" : config ? "disabled" : "not configured"}
                            </p>
                            {config?.provider && (
                                <p className="text-sm text-muted-fg">Provider: {config.provider}</p>
                            )}
                        </div>
                    </div>
                    {config && (
                        <Button
                            variant="outline"
                            onClick={handleToggle}
                            isLoading={isToggling}
                            className={config.enabled ? "border-danger/40 text-danger hover:bg-danger-soft" : "border-ok/40 text-ok hover:bg-ok-soft"}
                        >
                            {config.enabled
                                ? <><ToggleRight className="mr-2 h-4 w-4" /> Disable SSO</>
                                : <><ToggleLeft className="mr-2 h-4 w-4" /> Enable SSO</>
                            }
                        </Button>
                    )}
                </CardContent>
            </Card>

            <p className="text-sm text-muted-fg">
                An organisation uses one SSO type at a time.
                {activeType ? ` Currently configured: ${activeType === "saml" ? "SAML 2.0" : "OAuth2 / OIDC"}.` : ""}
            </p>

            <div className="flex gap-2 border-b border-edge-subtle">
                {(["oauth2", "saml"] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
                            activeTab === tab ? "border-brand text-brand" : "border-transparent text-muted-fg hover:text-foreground",
                        )}
                    >
                        {tab === "oauth2" ? "OAuth2 / OIDC" : "SAML 2.0"}
                    </button>
                ))}
            </div>

            {activeTab === "oauth2" && (
                <Card>
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
                                    <Label htmlFor="clientId">Client ID <span className="text-danger">*</span></Label>
                                    <Input id="clientId" placeholder="your-client-id" {...limitInputProps(L.clientId)} {...oauth2Form.register("clientId", { ...limitRules<SsoOAuth2Dto, "clientId">(L.clientId, "Client ID"), required: "Client ID is required" })} />
                                    <FieldError error={o2e.clientId} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientSecret">Client Secret {activeType !== "oauth2" && <span className="text-danger">*</span>}</Label>
                                    <Input id="clientSecret" type="password" placeholder={activeType === "oauth2" ? "Leave blank to keep existing" : "Enter client secret"} {...oauth2Form.register("clientSecret", { required: activeType !== "oauth2" ? "Client secret is required" : false })} />
                                    <FieldError error={o2e.clientSecret} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="issuerUri">Issuer URI <span className="text-danger">*</span></Label>
                                <Input id="issuerUri" type="url" placeholder="https://accounts.google.com" {...limitInputProps(L.issuerUri)} {...oauth2Form.register("issuerUri", { ...limitRules<SsoOAuth2Dto, "issuerUri">(L.issuerUri, "Issuer URI"), required: "Issuer URI is required", validate: httpsUrlRule })} />
                                <FieldError error={o2e.issuerUri} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="redirectUri">Redirect URI</Label>
                                <Input id="redirectUri" type="url" placeholder="https://yourapp.com/auth/callback" {...oauth2Form.register("redirectUri", { validate: httpUrlRule })} />
                                <FieldError error={o2e.redirectUri} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="oauth2-emailDomain">Email Domain</Label>
                                <Input id="oauth2-emailDomain" placeholder="company.com" {...limitInputProps(L.emailDomain)} {...oauth2Form.register("emailDomain", { ...limitRules<SsoOAuth2Dto, "emailDomain">(L.emailDomain, "Email domain"), validate: emailDomainRule })} />
                                <FieldError error={o2e.emailDomain} />
                                <p className="text-xs text-faint-fg">
                                    Users with this email domain will be automatically routed to your SSO provider at login.
                                </p>
                            </div>

                            <div className="flex justify-end border-t border-edge-subtle pt-4">
                                <Button type="submit" isLoading={oauth2Form.formState.isSubmitting}>
                                    Save OAuth2 Config
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {activeTab === "saml" && (
                <Card>
                    <CardHeader>
                        <CardTitle>SAML 2.0 Configuration</CardTitle>
                        <CardDescription>Connect an enterprise identity provider using SAML 2.0.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={samlForm.handleSubmit(onSubmitSaml)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="saml-provider">Provider</Label>
                                <Input id="saml-provider" value="SAML 2.0" readOnly disabled />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="idpMetadataUrl">IdP Metadata URL <span className="text-danger">*</span></Label>
                                <Input id="idpMetadataUrl" type="url" placeholder="https://idp.company.com/metadata" {...samlForm.register("idpMetadataUrl", { required: "IdP metadata URL is required", validate: httpUrlRule })} />
                                <FieldError error={se.idpMetadataUrl} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="spEntityId">SP Entity ID <span className="text-danger">*</span></Label>
                                <Input id="spEntityId" placeholder="https://yourapp.com" {...limitInputProps(L.spEntityId)} {...samlForm.register("spEntityId", { ...limitRules<SsoSamlDto, "spEntityId">(L.spEntityId, "SP entity ID"), required: "SP entity ID is required" })} />
                                <FieldError error={se.spEntityId} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="acsUrl">Assertion Consumer Service URL <span className="text-danger">*</span></Label>
                                <Input id="acsUrl" type="url" placeholder="https://yourapp.com/saml/acs" {...samlForm.register("assertionConsumerServiceUrl", { required: "ACS URL is required", validate: httpUrlRule })} />
                                <FieldError error={se.assertionConsumerServiceUrl} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="saml-emailDomain">Email Domain</Label>
                                <Input id="saml-emailDomain" placeholder="company.com" {...limitInputProps(L.emailDomain)} {...samlForm.register("emailDomain", { ...limitRules<SsoSamlDto, "emailDomain">(L.emailDomain, "Email domain"), validate: emailDomainRule })} />
                                <FieldError error={se.emailDomain} />
                                <p className="text-xs text-faint-fg">
                                    Users with this email domain will be automatically routed to your SSO provider at login.
                                </p>
                            </div>

                            <div className="flex justify-end border-t border-edge-subtle pt-4">
                                <Button type="submit" isLoading={samlForm.formState.isSubmitting}>
                                    Save SAML Config
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
            <ConfirmModal
                isOpen={pendingReplace !== null}
                variant="warning"
                title="Replace the existing SSO configuration?"
                message={pendingReplace ? replaceWarning(pendingReplace.type) : ""}
                confirmLabel="Replace"
                onCancel={() => setPendingReplace(null)}
                onConfirm={() => { void confirmReplace(); }}
            />
        </div>
    );
}
