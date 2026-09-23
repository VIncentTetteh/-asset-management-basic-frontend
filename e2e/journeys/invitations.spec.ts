import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Joining on an invitation, against the real static export.
 *
 * Runs unauthenticated, which is the whole point: /accept-invite has to work
 * for someone with no account and no session, and the app shell has to let it.
 * A regression that put the page back behind the authenticated shell would show
 * up here as a redirect to /login, and nowhere else in the fast suite.
 *
 * The API is stubbed at the network boundary rather than run, so this belongs
 * in the CI-friendly config alongside the other public-page specs.
 */

const ORG_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EMAIL = "ama.mensah@acme.test";

const PREVIEW = {
    valid: true,
    reason: null,
    organisationName: "Acme Manufacturing Ghana",
    email: EMAIL,
    roleName: "Asset Manager",
    roleDescription: "Looks after the register day to day.",
    firstName: "Ama",
    lastName: null,
    invitedByName: "Vincent Tetteh",
    note: "You'll be looking after the Accra office register.",
    expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    permissions: [
        {
            key: "DISPOSE_ASSET",
            label: "Dispose of assets",
            summary: "Record write-offs, sales and scrappage, retiring the asset.",
            group: "Assets",
            write: true,
            enforced: true,
        },
        {
            // Granted, but gates nothing today. The invitee must not be promised it.
            key: "REGENERATE_QR",
            label: "Reissue asset QR codes",
            summary: "Issue a replacement QR label for an asset.",
            group: "Assets",
            write: true,
            enforced: false,
        },
    ],
};

const invalidPreview = (reason: string) => ({
    valid: false,
    reason,
    organisationName: null,
    email: null,
    roleName: null,
    roleDescription: null,
    firstName: null,
    lastName: null,
    invitedByName: null,
    note: null,
    expiresAt: null,
    permissions: [],
});

function json(body: unknown, status = 200): Parameters<Route["fulfill"]>[0] {
    return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** Records every invitation request so the spec can assert what was sent. */
async function stubInvitationApi(
    page: Page,
    options: { preview?: unknown; acceptStatus?: number; acceptBody?: unknown } = {},
): Promise<{ bodies: Record<string, unknown>[] }> {
    const bodies: Record<string, unknown>[] = [];
    await page.route("**/api/v1/invitations/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        bodies.push({ path, ...(route.request().postDataJSON() as Record<string, unknown>) });
        if (path.endsWith("/lookup")) {
            return route.fulfill(json(options.preview ?? PREVIEW));
        }
        if (path.endsWith("/accept")) {
            return route.fulfill(
                json(
                    options.acceptBody ?? {
                        userId: "0f9d4c2a-0000-4000-8000-00000000abcd",
                        email: EMAIL,
                        organisationId: ORG_ID,
                        organisationName: "Acme Manufacturing Ghana",
                        roleName: "Asset Manager",
                        message: "Welcome.",
                    },
                    options.acceptStatus ?? 201,
                ),
            );
        }
        return route.fulfill(json({}, 404));
    });
    // Anything else the shell asks for on a public page is refused, as it would
    // be for a visitor with no session.
    await page.route("**/api/v1/**", (route) =>
        route.request().url().includes("/invitations/")
            ? route.fallback()
            : route.fulfill(json({ message: "Unauthorized" }, 401)),
    );
    return { bodies };
}

test.describe("joining on an invitation", () => {
    test("shows the offer, takes the token out of the URL, and lands on sign-in", async ({ page }) => {
        const { bodies } = await stubInvitationApi(page);

        await page.goto("/accept-invite?token=tok_e2e_abc123");

        // The offer, in plain language.
        await expect(
            page.getByRole("heading", { name: /invited you to join Acme Manufacturing Ghana/i }),
        ).toBeVisible();
        await expect(page.getByText("Dispose of assets")).toBeVisible();
        await expect(page.getByText("Record write-offs, sales and scrappage, retiring the asset.")).toBeVisible();
        // An unenforced permission is never offered to the invitee.
        await expect(page.getByText("Reissue asset QR codes")).toHaveCount(0);

        // The token was POSTed, and is gone from the address bar so nothing
        // downstream can leak it as a referrer.
        expect(bodies[0]).toMatchObject({ path: "/api/v1/invitations/lookup", token: "tok_e2e_abc123" });
        await expect.poll(() => new URL(page.url()).search).toBe("");

        await page.getByLabel(/Last name/).fill("Mensah");
        await page.getByLabel(/Choose a password/).fill("correct horse battery");
        await page.getByRole("button", { name: /^Join Acme Manufacturing Ghana$/ }).click();

        // No session is issued, so the only honest destination is login —
        // carrying the organisation, because the address may exist in several.
        await page.waitForURL(/\/login\?/);
        const url = new URL(page.url());
        expect(url.pathname).toBe("/login");
        expect(url.searchParams.get("org")).toBe(ORG_ID);
        expect(url.searchParams.get("email")).toBe(EMAIL);
        await expect(page.getByText(/Sign in with the password you just chose/i)).toBeVisible();
        await expect(page.getByLabel("Email")).toHaveValue(EMAIL);

        const accept = bodies.find((body) => body.path === "/api/v1/invitations/accept");
        expect(accept).toMatchObject({ token: "tok_e2e_abc123", firstName: "Ama", lastName: "Mensah" });
    });

    test("explains an expired link instead of showing an error page", async ({ page }) => {
        await stubInvitationApi(page, { preview: invalidPreview("EXPIRED") });

        await page.goto("/accept-invite?token=tok_expired");

        await expect(page.getByRole("heading", { name: /This invitation has expired/i })).toBeVisible();
        await expect(page.getByLabel(/Choose a password/)).toHaveCount(0);
        await expect(page.getByRole("link", { name: /Go to sign in/i })).toBeVisible();
    });

    test("is reachable with no session at all — the shell must not send an invitee to login", async ({ page }) => {
        await stubInvitationApi(page);

        await page.goto("/accept-invite?token=tok_public");
        await expect(page.getByRole("heading", { name: /invited you to join/i })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe("/accept-invite");
    });

    test("the sign-up page promises only what actually happens", async ({ page }) => {
        await page.goto("/register");

        await expect(page.getByRole("heading", { name: /You need an invitation/i })).toBeVisible();
        await expect(page.getByText(/You choose your own password there/i)).toBeVisible();
        // The old copy promised login details by email. Nothing does that.
        await expect(page.getByText(/welcome email with login details/i)).toHaveCount(0);
    });
});
