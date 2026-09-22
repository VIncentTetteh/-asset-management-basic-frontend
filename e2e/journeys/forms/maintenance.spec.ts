import { uniq } from "../../fixtures/auth";
import type { FieldSpec } from "../../fixtures/forms";
import { createAsset, createSupplier, dropAsset, dropSupplier, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { baseCurrency } from "./_core-helpers";

// The list shows a record by its asset's name, so each run gets its own asset.
const asset = uniq("MaintAsset");
const vendor = uniq("MaintVendor");
let assetId: string | undefined;
let vendorId: string | undefined;

// Currency options are the org's currencies (no empty option): use the base
// currency, which the api-created asset is valued in too.
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

describeRoundTrip({
    title: "Maintenance",
    path: "/maintenance",
    key: asset,
    createButton: /^Log maintenance$/i,
    editButton: /^Edit maintenance$/i,
    deleteButton: /^Delete maintenance$/i,
    setup: async ({ api }) => {
        currency.value = await baseCurrency(api);
        assetId = (await createAsset(api, asset, { currency: currency.value })).id;
        vendorId = (await createSupplier(api, vendor)).id;
    },
    teardown: async ({ api }) => {
        await dropAsset(api, assetId);
        await dropSupplier(api, vendorId);
    },
    fields: [
        // Option text is "<name> (<tag>)"; the select is disabled on edit (asset is fixed).
        { label: "Target asset", type: "select", value: asset },
        { label: "Maintenance type", type: "select", value: "CORRECTIVE", edit: "EMERGENCY" },
        // Cancelled keeps a cleared completion date blank (only COMPLETED defaults it to today).
        { label: "Status", type: "select", value: "In progress", edit: "Cancelled" },
        { label: "Task description / issue", type: "textarea", value: uniq("replace fan and battery"), optional: true },
        { label: "Scheduled date", type: "date", value: isoDate(3), edit: isoDate(5) },
        currency,
        { label: "Estimated / actual cost", type: "number", value: 350.5, optional: true },
        { label: "Technician / vendor", type: "select", value: vendor, optional: true },
        { label: "Completion date", type: "date", value: isoDate(-1), optional: true },
        { label: "Next due date", type: "date", value: isoDate(90), optional: true },
    ],
    negative: [
        // The form passes "Cost" to limitRules.
        { field: "Estimated / actual cost", value: -1, error: /Cost must be at least 0/ },
    ],
});
