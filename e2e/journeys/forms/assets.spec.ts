import { uniq } from "../../fixtures/auth";
import { overLength, type FieldSpec } from "../../fixtures/forms";
import {
    createCategory,
    createDepartment,
    createLocation,
    createSupplier,
    dropCategory,
    dropDepartment,
    dropLocation,
    dropSupplier,
    isoDate,
} from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { baseCurrency, createPurchaseOrder, dropPurchaseOrder } from "./_core-helpers";

// Every relation picker gets a record of its own, selected by its unique name.
const category = uniq("AssetCategory");
const department = uniq("AssetDept");
const location = uniq("AssetLocation");
const supplier = uniq("AssetSupplier");
const poNumber = uniq("AssetPO");
const ids: Record<string, string | undefined> = {};

// The currency select lists only the org's currencies (no empty option): the
// org base currency is picked in setup and kept on edit.
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

describeRoundTrip({
    title: "Assets",
    path: "/assets",
    key: uniq("Asset"),
    editedKey: uniq("Asset-edited"),
    createButton: /^Add asset$/i,
    editButton: /^Edit asset$/i,
    deleteButton: /^Delete asset$/i,
    searchPlaceholder: /Search name, tag, or model/i,
    setup: async ({ api }) => {
        currency.value = await baseCurrency(api);
        ids.category = (await createCategory(api, category)).id;
        ids.department = (await createDepartment(api, department)).id;
        ids.location = (await createLocation(api, location)).id;
        ids.supplier = (await createSupplier(api, supplier)).id;
        ids.po = (await createPurchaseOrder(api, poNumber, ids.department, ids.supplier, String(currency.value))).id;
    },
    teardown: async ({ api }) => {
        await dropPurchaseOrder(api, ids.po);
        await dropSupplier(api, ids.supplier);
        await dropLocation(api, ids.location);
        await dropDepartment(api, ids.department);
        await dropCategory(api, ids.category);
    },
    fields: [
        // Identification & type
        { label: "Asset name", type: "text", value: uniq("Asset"), edit: uniq("Asset-edited") },
        { label: "Asset type", type: "select", value: "EQUIPMENT", edit: "VEHICLE" },
        { label: "Asset tag", type: "text", value: uniq("TAG"), optional: true },
        { label: "Serial number", type: "text", value: uniq("SN"), optional: true },
        { label: "Category", type: "select", value: category, optional: true },
        { label: "Description", type: "textarea", value: uniq("asset description"), optional: true },
        // Manufacturer details
        { label: "Manufacturer", type: "text", value: uniq("Maker"), optional: true },
        { label: "Model", type: "text", value: uniq("Model"), optional: true },
        // Financial & depreciation
        { label: "Purchase date", type: "date", value: isoDate(-30), optional: true },
        { label: "Cost", type: "number", value: 2500, optional: true },
        currency,
        { label: "Procurement type", type: "select", value: "CAPEX", optional: true },
        { label: "Cost centre", type: "text", value: uniq("CC"), optional: true },
        { label: "Invoice reference", type: "text", value: uniq("INV"), optional: true },
        { label: "Depreciation", type: "select", value: "DECLINING BALANCE", optional: true },
        { label: "Useful life (months)", type: "number", value: 48, optional: true },
        { label: "Residual value", type: "number", value: 250, optional: true },
        { label: "Insurance premium / year", type: "number", value: 120, optional: true },
        { label: "Downtime cost / day", type: "number", value: 75, optional: true },
        { label: "Insurance policy expiry", type: "date", value: isoDate(365), optional: true },
        { label: "Insurance policy number", type: "text", value: uniq("POL"), optional: true },
        // Status & condition (IN_STOCK -> RESERVED is an allowed transition)
        { label: "Current status", type: "select", value: "IN STOCK", edit: "RESERVED" },
        { label: "Physical condition", type: "select", value: "GOOD", edit: "FAIR" },
        { label: "Warranty expiry", type: "date", value: isoDate(730), optional: true },
        // Assignment & location
        { label: "Department", type: "select", value: department, optional: true },
        { label: "Location", type: "select", value: location, optional: true },
        { label: "Supplier", type: "select", value: supplier, optional: true },
        { label: "Purchase order", type: "select", value: poNumber, optional: true },
    ],
    negative: [
        { field: "Asset name", value: overLength(255), error: /Name must be at most 255 characters/ },
        { field: "Cost centre", value: overLength(100), error: /Cost centre must be at most 100 characters/ },
        { field: "Useful life (months)", value: 0, error: /Useful life must be at least 1/ },
        { field: "Cost", value: -1, error: /Cost must be at least 0/ },
        // Cost is 2500 in the filled form: a larger residual fails the cross-field rule.
        { field: "Residual value", value: 999_999, error: /Residual value cannot exceed the cost/ },
    ],
});
