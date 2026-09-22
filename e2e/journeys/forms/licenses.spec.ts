import { PREFIX, uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { createAsset, dropAsset, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { currencyField, dropWhere, loadCurrencies } from "./_leases-licenses-helpers";

// src/app/licenses/page.tsx: edits are a full PUT, so every optional field
// cleared in the edit step must come back empty. The "Linked asset" picker
// needs a real asset. The list has no search box but renders every license.
const name = uniq("License");
const nameEdited = uniq("License-edited");
const assetName = uniq("LicenseAsset");
const currency = currencyField();
let assetId: string | undefined;

describeRoundTrip({
    title: "Software licenses",
    path: "/licenses",
    key: name,
    editedKey: nameEdited,
    createButton: /^New license$/i,
    editButton: /^Edit license$/i,
    deleteButton: /^Delete license$/i,
    setup: async ({ api }) => {
        assetId = (await createAsset(api, assetName)).id;
        await loadCurrencies(api, currency);
    },
    teardown: async ({ api }) => {
        await dropWhere<{ id?: string; name?: string }>(
            api,
            await api.withOrg("/licenses"),
            (license) => license.name === name || license.name === nameEdited,
            (id) => api.withOrg(`/licenses/${id}`),
        );
        await dropAsset(api, assetId);
    },
    fields: [
        { label: "License name", type: "text", value: name, edit: nameEdited },
        { label: "Vendor", type: "text", value: uniq("Vendor"), edit: uniq("Vendor-edited") },
        { label: "Product", type: "text", value: uniq("Product"), optional: true },
        { label: "Version", type: "text", value: "2026.1-e2e", optional: true },
        // Option texts are the enum with "_" as spaces; neither select has an empty option.
        { label: "Type", type: "select", value: "VOLUME", edit: "OPEN SOURCE" },
        { label: "Status", type: "select", value: "ACTIVE", edit: "SUSPENDED" },
        { label: "Total seats", type: "number", value: 50, optional: true },
        // A blank seat count means none: the API stores 0.
        { label: "Seats in use", type: "number", value: 12, edit: 0, optional: true },
        { label: "Purchase date", type: "date", value: isoDate(-30), optional: true },
        // Far from today, so the API never re-labels the status as expiring.
        { label: "Expiry date", type: "date", value: isoDate(365), optional: true },
        { label: "Renewal date", type: "date", value: isoDate(335), optional: true },
        { label: "Purchase cost", type: "number", value: 1200.5, optional: true },
        { label: "Annual renewal", type: "number", value: 300.25, optional: true },
        currency,
        { label: "Auto-renews", type: "checkbox", value: true, edit: false },
        { label: "Linked asset", type: "select", value: assetName, optional: true },
        {
            label: "Document URL",
            type: "text",
            value: `https://example.com/e2e/${PREFIX.toLowerCase()}license.pdf`,
            optional: true,
        },
        { label: "Notes", type: "textarea", value: uniq("license notes"), optional: true },
    ],
    negative: [
        { field: "License name", value: overLength(255), error: /License name must be at most 255 characters/ },
        { field: "Version", value: overLength(255), error: /Version must be at most 255 characters/ },
        { field: "Document URL", value: "ftp://example.com/license.pdf", error: /Document URL must be an http:\/\/ or https:\/\/ link/ },
        { field: "Total seats", value: -1, error: /Total seats must be at least 0/ },
    ],
});
