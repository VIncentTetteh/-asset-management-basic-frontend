import { uniq } from "../../fixtures/auth";
import { overLength, type FieldSpec } from "../../fixtures/forms";
import { createAsset, createSupplier, dropAsset, dropSupplier, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { applyCurrencies, orgCurrencies } from "./_finance-helpers";

// A supplier and an asset for the two pickers (the asset option reads "name (tag)").
const supplier = uniq("CT-Supplier");
const asset = uniq("CT-Asset");
let supplierId: string | undefined;
let assetId: string | undefined;

// Filled in at setup from the tenant's currencies (see applyCurrencies).
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

describeRoundTrip({
    title: "Contracts",
    path: "/contracts",
    key: uniq("Contract"),
    editedKey: uniq("Contract-edited"),
    createButton: /New contract/i,
    editButton: /^Edit contract$/i,
    deleteButton: /^Delete contract$/i,
    setup: async ({ api }) => {
        applyCurrencies(currency, await orgCurrencies(api));
        supplierId = (await createSupplier(api, supplier)).id;
        assetId = (await createAsset(api, asset)).id;
    },
    teardown: async ({ api }) => {
        await dropAsset(api, assetId);
        await dropSupplier(api, supplierId);
    },
    fields: [
        { label: "Title", type: "text", value: uniq("Contract"), edit: uniq("Contract-edited") },
        { label: "Contract number", type: "text", value: uniq("CT-NO"), optional: true },
        // Type and status have no empty option: changed, not cleared.
        { label: "Type", type: "select", value: "SERVICE LEVEL AGREEMENT", edit: "WARRANTY" },
        { label: "Status", type: "select", value: "DRAFT", edit: "ACTIVE" },
        { label: "Supplier", type: "select", value: supplier, optional: true },
        { label: "Linked asset", type: "select", value: asset, optional: true },
        { label: "Start date", type: "date", value: isoDate(0), edit: isoDate(1) },
        { label: "End date", type: "date", value: isoDate(365), edit: isoDate(400) },
        // The API stores a blank alert window as its default (30 days), so it is changed instead.
        { label: "Alert days before end", type: "number", value: 45, edit: 60 },
        { label: "Value", type: "number", value: 12_345.67, optional: true },
        currency,
        { label: "Auto-renews at end date", type: "checkbox", value: true, optional: true },
        { label: "Document URL", type: "text", value: "https://example.com/e2e/contract.pdf", optional: true },
        { label: "Key terms", type: "textarea", value: uniq("contract key terms"), optional: true },
    ],
    negative: [
        { field: "Title", value: overLength(255), error: /Title must be at most 255 characters/ },
        { field: "Contract number", value: overLength(100), error: /Contract number must be at most 100 characters/ },
        // The rule's label is "Alert days" (not the visible "Alert days before end").
        { field: "Alert days before end", value: -1, error: /Alert days must be at least 0/ },
        { field: "Document URL", value: "ftp://example.com/contract.pdf", error: /Document URL must be an http:\/\/ or https:\/\/ link/ },
    ],
});
