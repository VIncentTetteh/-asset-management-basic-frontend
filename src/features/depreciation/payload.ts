import type { DepreciationPolicy, DepreciationPolicyDto } from "@/types";

/** Methods the API accepts (`DepreciationMethod`), in the order the form lists them. */
export const DEPRECIATION_METHODS = [
    "STRAIGHT_LINE",
    "DECLINING_BALANCE",
    "SUM_OF_YEARS_DIGITS",
    "UNITS_OF_PRODUCTION",
] as const;

export const METHOD_LABEL: Record<string, string> = {
    STRAIGHT_LINE: "Straight line",
    DECLINING_BALANCE: "Declining balance",
    SUM_OF_YEARS_DIGITS: "Sum of years' digits",
    UNITS_OF_PRODUCTION: "Units of production",
};

/**
 * AssetIQ records no usage (units or hours), so the calculator depreciates
 * UNITS_OF_PRODUCTION on a straight line (`DepreciationCalculator`). Say so.
 */
export const UNITS_OF_PRODUCTION_HINT =
    "AssetIQ does not record usage yet, so units of production falls back to straight-line depreciation.";

/** Raw form values: inputs give strings, "" means "not given". */
export interface DepreciationPolicyForm {
    name?: string;
    method?: string;
    usefulLifeMonths?: string | number | null;
    salvageValuePercent?: string | number | null;
    description?: string | null;
}

const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const optionalNumber = (v: unknown): number | null => {
    if (blank(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Form values for a policy being edited: stored values as they are, never a made-up default. */
export function depreciationPolicyFormValues(policy: DepreciationPolicy | null): DepreciationPolicyForm {
    if (!policy) {
        return { name: "", method: "STRAIGHT_LINE", usefulLifeMonths: "", salvageValuePercent: "", description: "" };
    }
    return {
        name: policy.name ?? "",
        method: policy.method ?? "STRAIGHT_LINE",
        usefulLifeMonths: policy.usefulLifeMonths ?? "",
        salvageValuePercent: policy.salvageValuePercent ?? "",
        description: policy.description ?? "",
    };
}

/**
 * Full body for POST and PUT /depreciation-policies. A blank useful life or
 * residual is sent as null (it used to become 0, or 36 from the prefill), and
 * the organisation comes from the session, not the form.
 */
export function buildDepreciationPolicyPayload(form: DepreciationPolicyForm): DepreciationPolicyDto {
    const life = optionalNumber(form.usefulLifeMonths);
    return {
        name: String(form.name ?? "").trim(),
        method: String(form.method ?? ""),
        usefulLifeMonths: life === null ? null : Math.round(life),
        salvageValuePercent: optionalNumber(form.salvageValuePercent),
        description: blank(form.description) ? null : String(form.description).trim(),
    };
}
