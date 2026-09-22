import { uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";

describeRoundTrip({
    title: "Departments",
    path: "/departments",
    key: uniq("Department"),
    editedKey: uniq("Department-edited"),
    createButton: /^New department$/i,
    editButton: /^Edit department$/i,
    deleteButton: /^Delete department$/i,
    searchPlaceholder: /Search name, code, or cost center/i,
    fields: [
        { label: "Name", type: "text", value: uniq("Department"), edit: uniq("Department-edited") },
        { label: "Department code", type: "text", value: uniq("DC"), optional: true },
        { label: "Cost center", type: "text", value: uniq("CC"), optional: true },
        // The label carries the base currency ("Planning cap (GHS)"). A cleared cap is
        // sent as 0 ("no cap") and the form reopens with 0, so the edit sets 0
        // explicitly instead of expecting an empty input.
        { label: /^\s*Planning cap \([A-Z]{3}\)\s*$/i, type: "number", value: 50000, edit: 0 },
        // No empty option: change it instead of clearing.
        { label: "Status", type: "select", value: "Active", edit: "Inactive" },
        { label: "Description", type: "textarea", value: uniq("department description"), optional: true },
    ],
    negative: [
        { field: "Name", value: overLength(255), error: /Name must be at most 255 characters/ },
        { field: "Department code", value: overLength(255), error: /Department code must be at most 255 characters/ },
        {
            field: { label: /^\s*Planning cap \([A-Z]{3}\)\s*$/i, type: "number", value: 0 },
            value: -1,
            error: /Planning cap must be at least 0/,
        },
    ],
});
