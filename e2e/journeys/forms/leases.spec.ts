import { uniq } from "../../fixtures/auth";
import {
    createAsset,
    createDepartment,
    createSupplier,
    dropAsset,
    dropDepartment,
    dropSupplier,
    isoDate,
} from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { currencyField, dropWhere, loadCurrencies } from "./_leases-licenses-helpers";

// src/app/leases/page.tsx: the lessor is a supplier record, the asset and
// department are pickers, so all three are created up front. The lease row is
// found by its asset's name (the asset does not change in the edit).
const assetName = uniq("LeaseAsset");
const lessor = uniq("Lessor");
const lessorEdited = uniq("Lessor-edited");
const department = uniq("LeaseDept");
const currency = currencyField();
const ids: { asset?: string; lessor?: string; lessorEdited?: string; department?: string } = {};

describeRoundTrip({
    title: "Leases",
    path: "/leases",
    key: assetName,
    createButton: /^New lease$/i,
    editButton: /^Edit lease$/i,
    deleteButton: /^Delete lease$/i,
    searchPlaceholder: /Search asset or lessor/i,
    setup: async ({ api }) => {
        ids.asset = (await createAsset(api, assetName)).id;
        ids.lessor = (await createSupplier(api, lessor)).id;
        ids.lessorEdited = (await createSupplier(api, lessorEdited)).id;
        ids.department = (await createDepartment(api, department)).id;
        await loadCurrencies(api, currency);
    },
    teardown: async ({ api }) => {
        // A lease left behind by a failed run would block the asset/supplier deletes.
        await dropWhere<{ id?: string; assetId?: string }>(
            api,
            "/leases",
            (lease) => lease.assetId === ids.asset,
            (id) => `/leases/${id}`,
        );
        await dropAsset(api, ids.asset);
        await dropSupplier(api, ids.lessor);
        await dropSupplier(api, ids.lessorEdited);
        await dropDepartment(api, ids.department);
    },
    fields: [
        { label: "Asset", type: "select", value: assetName },
        { label: "Lessor", type: "select", value: lessor, edit: lessorEdited },
        { label: "Start date", type: "date", value: isoDate(-30), edit: isoDate(-15) },
        { label: "End date", type: "date", value: isoDate(335), edit: isoDate(700) },
        { label: "Monthly payment", type: "number", value: 1500.5, edit: 1750.25 },
        currency,
        // Optional on the form, but a blank notice period is omitted from the PUT
        // and the API keeps the stored value, so it is changed rather than cleared.
        { label: "Notice period (days)", type: "number", value: 60, edit: 90 },
        { label: "Auto-renews", type: "checkbox", value: true, edit: false },
        { label: "Department", type: "select", value: department, optional: true },
        { label: "Notes", type: "textarea", value: uniq("lease notes"), optional: true },
    ],
    negative: [
        { field: "Monthly payment", value: 0, error: /Monthly payment must be at least 0\.01/ },
        { field: "Monthly payment", value: 10_000_000_000_000, error: /Monthly payment must be at most 9999999999999\.99/ },
        { field: "Notice period (days)", value: -1, error: /Notice period must be at least 0/ },
    ],
});
