import axios from "axios";

/** One organisation the signed-in email may enter, as listed by a 409 from /auth/login. */
export interface LoginOrganisationChoice {
    id: string;
    name: string;
}

/**
 * Reads the organisation choices from a login error.
 *
 * The API answers 409 `ORGANISATION_REQUIRED` only after the password has been
 * checked against every listed tenant, so the list never reveals membership to
 * someone who does not hold the password. Anything else returns null.
 */
export function organisationChoicesFromError(error: unknown): LoginOrganisationChoice[] | null {
    if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
    const data = error.response.data as { code?: unknown; organisations?: unknown } | undefined;
    if (data?.code !== "ORGANISATION_REQUIRED" || !Array.isArray(data.organisations)) return null;
    const choices = data.organisations.filter(
        (o): o is LoginOrganisationChoice =>
            typeof o === "object" && o !== null
            && typeof (o as LoginOrganisationChoice).id === "string"
            && typeof (o as LoginOrganisationChoice).name === "string",
    );
    return choices.length > 0 ? choices : null;
}
