import axios from "axios";

/** One organisation the signed-in email may enter, as listed by a 409 from /auth/login. */
export interface LoginOrganisationChoice {
    id: string;
    name: string;
}

/** A UUID, and nothing else — this value is put into a login request. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where to send someone who has just accepted an invitation.
 *
 * Accepting issues no session: the invitee signs in through the ordinary login
 * flow so MFA, lockout and organisation disambiguation are decided in one
 * place. The organisation has to travel with them, because the same address may
 * exist in several tenants and the login API would otherwise answer 409 and ask
 * a question the invitee has no way to answer.
 *
 * Neither value is a secret — the email is their own and the organisation id is
 * already in their invitation — but both are validated rather than pasted, so a
 * crafted acceptance response cannot write arbitrary query strings.
 */
export function loginPathAfterAccepting(organisationId?: string | null, email?: string | null): string {
    const params = new URLSearchParams();
    if (typeof organisationId === "string" && UUID.test(organisationId)) params.set("org", organisationId);
    if (typeof email === "string" && email.includes("@") && email.length <= 255) params.set("email", email);
    const query = params.toString();
    return query ? `/login?${query}` : "/login";
}

/** The organisation pinned on a `/login?org=…` link, when it is a well-formed id. */
export function organisationFromSearch(search: string): string {
    const value = new URLSearchParams(search).get("org");
    return value && UUID.test(value) ? value : "";
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
