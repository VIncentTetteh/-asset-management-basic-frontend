import { uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";

describeRoundTrip({
    title: "Depreciation policies",
    path: "/depreciation-policies",
    key: uniq("DepPolicy"),
    editedKey: uniq("DepPolicy-edited"),
    createButton: /^New policy$/i,
    editButton: /^Edit policy$/i,
    deleteButton: /^Delete policy$/i,
    fields: [
        { label: "Policy name", type: "text", value: uniq("DepPolicy"), edit: uniq("DepPolicy-edited") },
        // Required, no empty option: change it instead of clearing.
        { label: "Depreciation method", type: "select", value: "Sum of years' digits", edit: "Declining balance" },
        // Blank is saved as null (not 0 or 36), so both clear to an empty input.
        { label: "Useful life (months)", type: "number", value: 60, optional: true },
        { label: "Residual value (%)", type: "number", value: 12.5, optional: true },
        { label: "Description", type: "text", value: uniq("policy description"), optional: true },
    ],
    negative: [
        // The form passes "Name" (not "Policy name") to limitRules.
        { field: "Policy name", value: overLength(255), error: /Name must be at most 255 characters/ },
        { field: "Useful life (months)", value: 0, error: /Useful life must be at least 1/ },
        { field: "Residual value (%)", value: 101, error: /Residual value must be at most 100/ },
    ],
});
