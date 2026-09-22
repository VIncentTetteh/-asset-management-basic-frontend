"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { DATA_RESIDENCY_REGIONS, type Organisation, type OrganisationDto } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/ui/country-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { applyApiFieldErrors } from "@/lib/api-validation";
import { buildPatchPayload } from "@/lib/patch";
import { timeZoneOptions } from "@/lib/time-zones";

const L = FIELD_LIMITS.organisation;

/** Editable organisation fields; blanks are "" in the form and clear the value on save. */
export type OrganisationFormValues = Required<
    Pick<OrganisationDto, "name" | "industry" | "timezone" | "contactEmail" | "contactPhone" | "address" | "country"
        | "registrationNumber" | "taxId" | "dpoName" | "dpoEmail" | "dataResidencyRegion">
>;

/** The form's starting values for an organisation (absent values become ""). */
export function organisationFormValues(org: Organisation): OrganisationFormValues {
    return {
        name: org.name ?? "",
        industry: org.industry ?? "",
        timezone: org.timezone ?? "",
        contactEmail: org.contactEmail ?? "",
        contactPhone: org.contactPhone ?? "",
        address: org.address ?? "",
        country: org.country ?? "",
        registrationNumber: org.registrationNumber ?? "",
        taxId: org.taxId ?? "",
        dpoName: org.dpoName ?? "",
        dpoEmail: org.dpoEmail ?? "",
        dataResidencyRegion: org.dataResidencyRegion ?? "GH",
    };
}

/** Only changed fields, trimmed; a cleared field is sent as "" (the API stores NULL). */
export function organisationPatch(initial: OrganisationFormValues, values: OrganisationFormValues): Partial<OrganisationDto> {
    const trimmed = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
    ) as OrganisationFormValues;
    return buildPatchPayload<OrganisationFormValues>(initial, trimmed);
}

export function OrganisationFormModal({
    organisation,
    onClose,
    onSave,
    isSaving,
}: {
    organisation: Organisation | null;
    onClose: () => void;
    onSave: (id: string, patch: Partial<OrganisationDto>) => Promise<unknown>;
    isSaving: boolean;
}) {
    const initial = useMemo(() => (organisation ? organisationFormValues(organisation) : null), [organisation]);
    const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<OrganisationFormValues>();
    const zones = useMemo(() => timeZoneOptions(organisation?.timezone), [organisation?.timezone]);

    useEffect(() => {
        if (initial) reset(initial);
    }, [initial, reset]);

    const onSubmit = async (values: OrganisationFormValues) => {
        if (!organisation || !initial) return;
        const patch = organisationPatch(initial, values);
        if (Object.keys(patch).length === 0) {
            toast("No changes to update");
            return;
        }
        try {
            await onSave(organisation.id, patch);
            onClose();
        } catch (err) {
            // Toasted by the mutation; keep the form open with the fields marked.
            applyApiFieldErrors(err, setError);
        }
    };

    return (
        <Modal
            isOpen={!!organisation}
            onClose={onClose}
            title={`Edit ${organisation?.name ?? "organisation"}`}
            description="Organisation profile, contact, legal and data-protection information."
        >
            <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-6 overflow-y-auto px-1">
                <section className="space-y-4">
                    <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Profile</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Name <span className="text-danger">*</span></Label>
                            <Input id="org-name" {...limitInputProps(L.name)}
                                {...register("name", limitRules<OrganisationFormValues, "name">(L.name, "Name"))} />
                            <FieldError error={errors.name} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-industry">Industry</Label>
                            <Input id="org-industry" {...limitInputProps(L.industry)}
                                {...register("industry", limitRules<OrganisationFormValues, "industry">(L.industry, "Industry"))} />
                            <FieldError error={errors.industry} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            {/* Read-only: suspending or deactivating your own organisation signed
                                everyone out with no way back. Billing and account closure own it. */}
                            <div className="flex h-9 items-center">
                                <StatusBadge status={organisation?.status || "ACTIVE"} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-timezone">Time zone</Label>
                            <Select id="org-timezone" {...register("timezone")}>
                                <option value="">Not set</option>
                                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                            </Select>
                            <FieldError error={errors.timezone} />
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Contact</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-email">Contact email</Label>
                            <Input id="org-email" type="email" {...limitInputProps(L.contactEmail)}
                                {...register("contactEmail", limitRules<OrganisationFormValues, "contactEmail">(L.contactEmail, "Contact email"))} />
                            <FieldError error={errors.contactEmail} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-phone">Contact phone</Label>
                            <Input id="org-phone" type="tel" placeholder="+233244999999" {...limitInputProps(L.contactPhone)}
                                {...register("contactPhone", limitRules<OrganisationFormValues, "contactPhone">(L.contactPhone, "Contact phone"))} />
                            <FieldError error={errors.contactPhone} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="org-address">Address</Label>
                            <Textarea id="org-address" {...register("address")} />
                            <FieldError error={errors.address} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-country">Country</Label>
                            <CountrySelect id="org-country" allowEmpty placeholder="Not set" legacyValue={organisation?.country} {...register("country")} />
                            <FieldError error={errors.country} />
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Legal &amp; tax</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-reg">Registration number</Label>
                            <Input id="org-reg" placeholder="GH-12345" {...limitInputProps(L.registrationNumber)}
                                {...register("registrationNumber", limitRules<OrganisationFormValues, "registrationNumber">(L.registrationNumber, "Registration number"))} />
                            <FieldError error={errors.registrationNumber} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-tax">Tax ID</Label>
                            <Input id="org-tax" placeholder="TID-9876" {...limitInputProps(L.taxId)}
                                {...register("taxId", limitRules<OrganisationFormValues, "taxId">(L.taxId, "Tax ID"))} />
                            <FieldError error={errors.taxId} />
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="border-b border-edge-subtle pb-1 text-sm font-bold text-foreground">Data protection</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="org-dpo-name">Data protection officer</Label>
                            <Input id="org-dpo-name" {...limitInputProps(L.dpoName)}
                                {...register("dpoName", limitRules<OrganisationFormValues, "dpoName">(L.dpoName, "DPO name"))} />
                            <FieldError error={errors.dpoName} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-dpo-email">DPO email</Label>
                            <Input id="org-dpo-email" type="email" {...limitInputProps(L.dpoEmail)}
                                {...register("dpoEmail", limitRules<OrganisationFormValues, "dpoEmail">(L.dpoEmail, "DPO email"))} />
                            <FieldError error={errors.dpoEmail} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-residency">Data residency</Label>
                            <Select id="org-residency" {...register("dataResidencyRegion")}>
                                {DATA_RESIDENCY_REGIONS.map((r) => (
                                    <option key={r} value={r}>{RESIDENCY_LABELS[r]}</option>
                                ))}
                            </Select>
                            <FieldError error={errors.dataResidencyRegion} />
                        </div>
                    </div>
                </section>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-edge-subtle bg-surface/95 pb-2 pt-4 backdrop-blur">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isSaving}>Save changes</Button>
                </div>
            </form>
        </Modal>
    );
}

const RESIDENCY_LABELS: Record<(typeof DATA_RESIDENCY_REGIONS)[number], string> = {
    GH: "Ghana",
    EU: "European Union",
    US: "United States",
    OTHER: "Other",
};
