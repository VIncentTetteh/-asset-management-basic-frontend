/**
 * The first-run checklist for a newly registered company.
 *
 * Mirrors `com.assetiq.dto.onboarding`. `dismissed` and `complete` are
 * independent on purpose: hiding the prompt does not pretend the work is done,
 * and the API keeps reporting the truth about every step so a settings page can
 * still show what is outstanding.
 */

/** Step keys, in the order the API returns them. */
export type OnboardingStepKey =
    | "verify_email"
    | "add_locations"
    | "add_categories"
    | "add_departments"
    | "add_assets"
    | "invite_team";

export interface OnboardingStep {
    key: string;
    title: string;
    description: string;
    /** True only when the underlying data exists — never inferred client-side. */
    done: boolean;
    count: number;
    /** "ORGANISATION" for company setup, "YOU" for something only this person can do. */
    scope: string;
    resource: string;
    /** Where the API creates one, e.g. "/api/v1/locations". */
    apiPath: string;
    optional: boolean;
}

export interface OnboardingStatus {
    dismissed: boolean;
    dismissedAt: string | null;
    complete: boolean;
    completedSteps: number;
    totalSteps: number;
    nextStepKey: string | null;
    steps: OnboardingStep[];
}
