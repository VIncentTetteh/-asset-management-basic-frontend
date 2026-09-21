import { DepreciationMethod } from "@/types";

const METHOD_LABELS: Record<string, string> = {
  [DepreciationMethod.STRAIGHT_LINE]: "Straight-line",
  [DepreciationMethod.DECLINING_BALANCE]: "Double-declining balance",
  [DepreciationMethod.SUM_OF_YEARS_DIGITS]: "Sum-of-digits (monthly)",
  // No usage data is recorded, so the server depreciates these on time.
  [DepreciationMethod.UNITS_OF_PRODUCTION]: "Units of production (straight-line)",
};

/** Human label for a depreciation method; unknown values fall back to a tidied code. */
export function depreciationMethodLabel(method?: string | null): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? method.replace(/_/g, " ").toLowerCase();
}

/** "36 months (3 years)" style useful-life text. */
export function usefulLifeLabel(months?: number | null): string {
  if (!months) return "—";
  if (months % 12 === 0) return `${months} months (${months / 12} yr${months === 12 ? "" : "s"})`;
  return `${months} months`;
}
