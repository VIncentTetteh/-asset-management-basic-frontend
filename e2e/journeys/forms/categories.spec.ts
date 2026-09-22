import { uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";

// A parent category and a depreciation policy, so both pickers get a real value.
const parent = uniq("CatParent");
const policy = uniq("CatPolicy");
const created: string[] = [];
let policyId: string | undefined;

describeRoundTrip({
    title: "Categories",
    path: "/categories",
    key: uniq("Category"),
    editedKey: uniq("Category-edited"),
    createButton: /New category/i,
    editButton: /Edit category/i,
    deleteButton: /Delete category/i,
    searchPlaceholder: /Search name or prefix/i,
    setup: async ({ api }) => {
        const p = await api.post<{ id: string }>("/categories", { name: parent });
        created.push(p.id);
        const dp = await api.post<{ id: string }>(await api.withOrg("/depreciation-policies"), {
            name: policy,
            method: "STRAIGHT_LINE",
            usefulLifeMonths: 36,
            salvageValuePercent: 10,
        });
        policyId = dp.id;
    },
    teardown: async ({ api }) => {
        for (const id of created) await api.tryDelete(`/categories/${id}`);
        if (policyId) await api.tryDelete(`/depreciation-policies/${policyId}`);
    },
    fields: [
        { label: "Name", type: "text", value: uniq("Category"), edit: uniq("Category-edited") },
        { label: "Asset prefix code", type: "text", value: "E2E", optional: true },
        { label: "Default warranty (months)", type: "number", value: 24, optional: true },
        { label: "Parent category", type: "select", value: parent, optional: true },
        { label: "Depreciation policy", type: "select", value: policy, optional: true },
        { label: "Description", type: "textarea", value: uniq("category description"), optional: true },
    ],
    negative: [
        { field: "Name", value: overLength(255), error: /Name must be at most 255 characters/ },
        { field: "Default warranty (months)", value: -1, error: /Default warranty must be at least 0/ },
    ],
});
