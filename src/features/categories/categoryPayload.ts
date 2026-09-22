import type { Category, CategoryDto } from "@/types";
import { buildPatchPayload } from "@/lib/patch";

/** Optional category fields an update can clear; mirrors `CategoryServiceImpl.CLEARABLE_FIELDS`. */
export const CLEARABLE_CATEGORY_FIELDS = [
  "depreciationPolicyId", "parentCategoryId", "description", "assetPrefixCode", "defaultWarrantyPeriodMonths",
] as const;
export type ClearableCategoryField = (typeof CLEARABLE_CATEGORY_FIELDS)[number];

/** Form values as a create body: the warranty as a number, blanks omitted. */
export function normaliseCategoryForm(form: CategoryDto): CategoryDto {
  const out: Record<string, unknown> = { ...form };
  const warranty = out.defaultWarrantyPeriodMonths;
  if (warranty === "" || warranty == null || Number.isNaN(Number(warranty))) delete out.defaultWarrantyPeriodMonths;
  else out.defaultWarrantyPeriodMonths = Number(warranty);
  for (const key of Object.keys(out)) {
    if (out[key] === "") delete out[key];
    else if (typeof out[key] === "string" && key !== "description") out[key] = (out[key] as string).trim();
  }
  return out as unknown as CategoryDto;
}

/**
 * PATCH body for an edited category: changed fields, plus `clearFields` for each
 * optional field the user emptied that had a value (a missing field means "unchanged").
 */
export function buildCategoryUpdate(original: Category, form: CategoryDto): Partial<CategoryDto> {
  const patch = buildPatchPayload<CategoryDto>(original as unknown as Partial<CategoryDto>, normaliseCategoryForm(form));
  const raw = form as unknown as Record<string, unknown>;
  const before = original as unknown as Record<string, unknown>;
  const clearFields = CLEARABLE_CATEGORY_FIELDS.filter(
    (field) => (raw[field] === "" || raw[field] == null) && before[field] != null && before[field] !== "",
  );
  if (clearFields.length > 0) patch.clearFields = clearFields;
  return patch;
}
