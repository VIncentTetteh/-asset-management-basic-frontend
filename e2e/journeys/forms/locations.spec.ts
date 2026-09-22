import { test, expect, uniq } from "../../fixtures/auth";
import { bypassNativeValidation, fieldControl, fillForm, formModal, toasts, DUPLICATE_TOAST, type FieldSpec } from "../../fixtures/forms";
import { createLocation, dropLocation } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";

// A parent location, so the "Parent location" picker gets a real value.
const parent = uniq("LocParent");
let parentId: string | undefined;

const fields: readonly FieldSpec[] = [
    { label: "Name", type: "text", value: uniq("Location"), edit: uniq("Location-edited") },
    { label: "Building", type: "text", value: uniq("Building"), optional: true },
    { label: "Floor", type: "text", value: "3", optional: true },
    { label: "Room", type: "text", value: uniq("Room"), optional: true },
    { label: "City", type: "text", value: uniq("City"), optional: true },
    // Stored as the ISO code, shown by name; "No country" is the empty option.
    { label: "Country", type: "select", value: "Ghana", optional: true },
    { label: "Address", type: "text", value: uniq("1 Independence Ave"), optional: true },
    { label: "Parent location", type: "select", value: parent, optional: true },
];

describeRoundTrip({
    title: "Locations",
    path: "/locations",
    key: uniq("Location"),
    editedKey: uniq("Location-edited"),
    createButton: /^New location$/i,
    editButton: /^Edit location$/i,
    deleteButton: /^Delete location$/i,
    searchPlaceholder: /Search name, city, or building/i,
    setup: async ({ api }) => {
        parentId = (await createLocation(api, parent)).id;
    },
    teardown: async ({ api }) => {
        await dropLocation(api, parentId);
    },
    fields,
    // No `negative`: the location form registers no limitRules (Name has only a
    // bare `required`, and its error <p> has no role=alert), so the runner's
    // role=alert assertion cannot apply. The required check is covered below.
});

test.describe("Locations: validation", () => {
    test("e) a blank name is refused inline and nothing is saved", async ({ page }) => {
        await page.goto("/locations");
        await page.getByRole("button", { name: /^New location$/i }).first().click();
        const form = formModal(page);
        await expect(form).toBeVisible();
        await fillForm(form, fields.filter((f) => f.label !== "Parent location"), "create");
        const name = await fieldControl(form, { label: "Name" });
        await bypassNativeValidation(form, name);
        await name.fill("");
        await form.locator('button[type="submit"]').last().click();

        await expect(form.getByText("Name is required")).toBeVisible();
        await expect(form, "the form stays open").toBeVisible();
        await expect(toasts(page).filter({ hasText: DUPLICATE_TOAST })).toHaveCount(0);
    });
});
