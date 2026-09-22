import { uniq } from "../../fixtures/auth";
import { overLength } from "../../fixtures/forms";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { deleteRoleViaUi, openRoleEdit } from "./_admin-helpers";

// Roles are cards (no table rows) with icon-only edit/delete buttons, so edit and
// delete locate the card by its title. Permission checkboxes are labelled with the
// permission name, underscores shown as spaces ("VIEW ASSETS").
describeRoundTrip({
    title: "Roles",
    path: "/roles",
    key: uniq("Role"),
    editedKey: uniq("Role-edited"),
    createButton: /^Create custom role$/i,
    openEdit: (page, key) => openRoleEdit(page, key),
    remove: ({ page }, key) => deleteRoleViaUi(page, key),
    fields: [
        { label: "Role Name", type: "text", value: uniq("Role"), edit: uniq("Role-edited") },
        { label: "Profile Description", type: "textarea", value: uniq("role description"), optional: true },
        // Granted on create, revoked on edit.
        { label: "VIEW ASSETS", type: "checkbox", value: true, edit: false },
        // Granted on create, cleared on edit (optional → unchecked).
        { label: "VIEW REPORTS", type: "checkbox", value: true, optional: true },
        // Granted on create and kept.
        { label: "VIEW COMPLIANCE", type: "checkbox", value: true },
        // Not granted on create, granted on edit.
        { label: "VIEW CONTRACTS", type: "checkbox", value: false, edit: true },
        { label: "VIEW SUPPLIERS", type: "checkbox", value: false, edit: true },
    ],
    negative: [{ field: "Role Name", value: overLength(255), error: /Name must be at most 255 characters/ }],
});
