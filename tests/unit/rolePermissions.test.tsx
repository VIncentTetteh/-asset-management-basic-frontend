import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RolesPage from "@/app/roles/page";

/**
 * The roles page against the permission catalogue.
 *
 * What this is really defending is the absence of the thing that was here
 * before: a hand-written table of groups and labels that had already drifted
 * from the enum it was copying. So the assertions are about where the words
 * come from (the API), and about the one distinction the page must never blur
 * — a permission that gates nothing must not look like one that works.
 */

const ROLE_ID = "b2a0d4d8-0000-4000-8000-000000000002";

const rolesSvc = vi.hoisted(() => ({
    getAll: vi.fn(),
    getPermissions: vi.fn(),
    getPermissionCatalogue: vi.fn(),
    getEffectivePermissions: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("@/services/roleService", () => ({ roleService: rolesSvc }));
vi.mock("@/contexts/PermissionContext", () => ({ usePermissions: () => ({ hasPermission: () => true, loading: false }) }));

const toastFns = vi.hoisted(() => {
    const fn = vi.fn() as ReturnType<typeof vi.fn> & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    fn.success = vi.fn();
    fn.error = vi.fn();
    return fn;
});
vi.mock("react-hot-toast", () => ({ toast: toastFns, default: toastFns }));

const CATALOGUE = [
    { key: "DISPOSE_ASSET", label: "Dispose of assets", summary: "Record write-offs, sales and scrappage.", group: "Assets", write: true, enforced: true },
    { key: "REGENERATE_QR", label: "Reissue asset QR codes", summary: "Issue a replacement QR label.", group: "Assets", write: true, enforced: false },
    { key: "ESCALATE_REQUESTS", label: "Escalate requests", summary: "Pass a request up to a higher approver.", group: "Approvals", write: true, enforced: false },
    { key: "REVIEW_ACCESS", label: "Review access", summary: "Run a periodic review of who holds which role.", group: "Settings", write: true, enforced: false },
];

const ROLE = {
    id: ROLE_ID,
    name: "Asset Manager",
    description: "Looks after the register day to day.",
    permissions: ["DISPOSE_ASSET", "REGENERATE_QR"],
    systemRole: false,
};

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    rolesSvc.getAll.mockResolvedValue([ROLE]);
    rolesSvc.getPermissionCatalogue.mockResolvedValue(CATALOGUE);
    rolesSvc.getPermissions.mockResolvedValue(CATALOGUE.map((entry) => entry.key));
});

function renderRoles() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <RolesPage />
        </QueryClientProvider>,
    );
}

describe("the roles page and the permission catalogue", () => {
    it("takes its labels and groups from the API instead of its own table", async () => {
        renderRoles();
        fireEvent.click(await screen.findByRole("button", { name: /Edit role Asset Manager/i }));

        // Group headings and labels are the catalogue's, and no authority
        // string is rendered as a label anywhere.
        expect(await screen.findByText("Assets")).toBeTruthy();
        expect(screen.getByLabelText("Dispose of assets")).toBeTruthy();
        expect(screen.getByText("Record write-offs, sales and scrappage.")).toBeTruthy();
        expect(screen.queryByText("DISPOSE_ASSET")).toBeNull();
        expect(rolesSvc.getPermissionCatalogue).toHaveBeenCalled();
    });

    it("marks every unenforced permission as not yet enforced, and says so in its summary", async () => {
        renderRoles();
        fireEvent.click(await screen.findByRole("button", { name: /Edit role Asset Manager/i }));
        await screen.findByText("Assets");

        // All three of the backend's unenforced permissions are labelled.
        expect(screen.getAllByText("Not enforced yet")).toHaveLength(3);
        expect(screen.getAllByText(/Nothing checks this permission today, so granting it has no effect/)).toHaveLength(3);
        // And a role that already carries one is warned about, not silently edited.
        expect(screen.getByText(/Some of these do nothing yet/)).toBeTruthy();
    });

    it("never presents an unenforced permission as something the role can do", async () => {
        rolesSvc.getEffectivePermissions.mockResolvedValue({
            roleId: ROLE_ID,
            roleName: "Asset Manager",
            description: "Looks after the register day to day.",
            systemRole: false,
            grantAllPermissions: false,
            permissionCount: 2,
            permissions: CATALOGUE.slice(0, 2),
            byGroup: {},
            unenforced: ["REGENERATE_QR"],
        });
        renderRoles();
        fireEvent.click(await screen.findByRole("button", { name: /What the Asset Manager role allows/i }));

        const panel = await screen.findByTestId("effective-permissions");
        expect(panel.textContent).toContain("Dispose of assets");
        expect(panel.textContent).toContain("1 of 2 granted permissions do something today");
        expect(panel.textContent).toContain("Granted, but not enforced anywhere yet");
        // Named the way the rest of the screen names it — never as a raw key.
        expect(panel.textContent).toContain("Reissue asset QR codes");
        expect(panel.textContent).not.toContain("REGENERATE_QR");
    });

    it("expands a grant-all role rather than showing it as empty", async () => {
        rolesSvc.getEffectivePermissions.mockResolvedValue({
            roleId: ROLE_ID,
            roleName: "Organisation Admin",
            description: null,
            systemRole: true,
            grantAllPermissions: true,
            permissionCount: 4,
            permissions: CATALOGUE,
            byGroup: {},
            unenforced: ["REGENERATE_QR", "ESCALATE_REQUESTS", "REVIEW_ACCESS"],
        });
        renderRoles();
        fireEvent.click(await screen.findByRole("button", { name: /What the Asset Manager role allows/i }));

        const panel = await screen.findByTestId("effective-permissions");
        expect(panel.textContent).toContain("this role carries all 4 permissions");
        expect(panel.textContent).toContain("Dispose of assets");
    });

    it("renders a failed roles load as a failure, not as 'no roles configured'", async () => {
        rolesSvc.getAll.mockRejectedValue(new Error("network down"));
        renderRoles();

        expect(await screen.findByText(/We couldn't load your roles/i)).toBeTruthy();
        expect(screen.queryByText(/No roles configured/i)).toBeNull();
    });

    it("saves the keys the catalogue gave it when a permission is toggled", async () => {
        rolesSvc.update.mockResolvedValue({ ...ROLE });
        renderRoles();
        fireEvent.click(await screen.findByRole("button", { name: /Edit role Asset Manager/i }));
        await screen.findByText("Assets");

        fireEvent.click(screen.getByLabelText("Escalate requests"));
        fireEvent.submit(
            (screen.getByRole("button", { name: /Save Updates/i }).closest("form")) as HTMLFormElement,
        );

        await waitFor(() => expect(rolesSvc.update).toHaveBeenCalledTimes(1));
        expect(rolesSvc.update.mock.calls[0][1].permissions).toEqual([
            "DISPOSE_ASSET",
            "REGENERATE_QR",
            "ESCALATE_REQUESTS",
        ]);
    });
});
