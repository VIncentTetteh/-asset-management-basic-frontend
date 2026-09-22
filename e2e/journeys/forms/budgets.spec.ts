import { uniq } from "../../fixtures/auth";
import { overLength, type FieldSpec } from "../../fixtures/forms";
import { createDepartment, dropDepartment, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { applyCurrencies, orgCurrencies } from "./_finance-helpers";

// A department for the picker. Its name must not contain the budget's name: the
// list search matches department names too.
const department = uniq("BudgetDept");
let departmentId: string | undefined;

// Filled in at setup from the tenant's currencies (see applyCurrencies).
const currency: FieldSpec = { label: "Currency", type: "select", value: "USD" };

describeRoundTrip({
    title: "Budgets",
    path: "/budgets",
    key: uniq("Budget-Main"),
    editedKey: uniq("Budget-Main-edited"),
    createButton: /New budget/i,
    editButton: /^Edit budget$/i,
    deleteButton: /^Delete budget$/i,
    searchPlaceholder: /Search budget or department/i,
    setup: async ({ api }) => {
        applyCurrencies(currency, await orgCurrencies(api));
        departmentId = (await createDepartment(api, department)).id;
    },
    teardown: async ({ api }) => {
        await dropDepartment(api, departmentId);
    },
    fields: [
        { label: "Name", type: "text", value: uniq("Budget-Main"), edit: uniq("Budget-Main-edited") },
        { label: "Description", type: "textarea", value: uniq("budget description"), optional: true },
        { label: "Allocated amount", type: "number", value: 50_000, edit: 75_000.5 },
        currency,
        { label: "Department", type: "select", value: department, optional: true },
        { label: "Fiscal year", type: "number", value: new Date().getFullYear(), optional: true },
        { label: "Period start", type: "date", value: isoDate(0), edit: isoDate(1) },
        { label: "Period end", type: "date", value: isoDate(365), edit: isoDate(400) },
        // No empty option; EXCEEDED is computed and cannot be chosen.
        { label: "Status", type: "select", value: "Active", edit: "Draft" },
        // A blank threshold is stored as the default (80) rather than cleared, so it is changed instead.
        { label: "Alert at % spent", type: "number", value: 75, edit: 90 },
    ],
    negative: [
        { field: "Name", value: overLength(255), error: /Name must be at most 255 characters/ },
        { field: "Allocated amount", value: 0, error: /Allocated amount must be at least 0\.01/ },
    ],
});
