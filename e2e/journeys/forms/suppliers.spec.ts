import { RUN_ID, uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";

// Email, tax ID and registration number are unique per tenant: all carry the run id.
const run = RUN_ID.toLowerCase();

describeRoundTrip({
    title: "Suppliers",
    path: "/suppliers",
    key: uniq("Supplier"),
    editedKey: uniq("Supplier-edited"),
    createButton: /New supplier/i,
    editButton: /^Edit supplier$/i,
    deleteButton: /^Delete supplier$/i,
    fields: [
        { label: "Company name", type: "text", value: uniq("Supplier"), edit: uniq("Supplier-edited") },
        { label: "Email", type: "text", value: `e2e-${run}-supplier@example.com`, optional: true },
        { label: "Phone", type: "text", value: "+233 30 000 0001", optional: true },
        { label: "Contact person", type: "text", value: uniq("contact"), optional: true },
        // No empty option: change it instead of clearing.
        { label: "Status", type: "select", value: "Active", edit: "Suspended" },
        { label: "Tax ID", type: "text", value: uniq("TAX"), optional: true },
        { label: "Registration number", type: "text", value: uniq("REG"), optional: true },
        { label: "Address", type: "textarea", value: uniq("supplier address"), optional: true },
    ],
    negative: [
        { field: "Company name", value: overLength(255), error: /Company name must be at most 255 characters/ },
        { field: "Contact person", value: overLength(255), error: /Contact person must be at most 255 characters/ },
    ],
});
