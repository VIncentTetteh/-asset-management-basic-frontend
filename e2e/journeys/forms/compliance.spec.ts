import { test, expect, RUN_ID, uniq } from "../../fixtures/auth";
import {
    bypassNativeValidation,
    fieldControl,
    formModal,
    overLength,
    setControl,
    type FieldSpec,
} from "../../fixtures/forms";
import { createAsset, dropAsset, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip, type Ctx, type NegativeCase } from "../../fixtures/roundtrip";
import { ADMIN_EMAIL } from "./_admin-helpers";

/**
 * Every compliance register is the same ComplianceCrudPage driven by a field
 * config (src/app/compliance/<slug>/page.tsx). One entry per register: its
 * fields as the form shows them, the text that identifies the row, and at least
 * one limit from src/lib/field-limits.ts (the error text uses the field label).
 *
 * Status-like selects get an `edit` value rather than being cleared: their "—"
 * option exists, but a status is not something a user blanks.
 * Owner / assignee pickers select the signed-in admin (option text ends "(email)").
 */

interface Register {
    slug: string;
    /** The page's `entity` prop: buttons read "New <entity>", "Edit <entity lower>", "Delete <entity lower>". */
    entity: string;
    fields: FieldSpec[];
    key: string;
    editedKey?: string;
    negative: NegativeCase[];
    /** False where the page has no delete (PCI SAQ answers): the record stays, prefixed. */
    canDelete?: boolean;
    setup?: (ctx: Ctx) => Promise<void>;
    teardown?: (ctx: Ctx) => Promise<void>;
}

const OWNER = ADMIN_EMAIL;
const JS_URL = "javascript:alert(1)";
const url = (name: string) => `https://example.com/e2e/${RUN_ID.toLowerCase()}/${name}`;
const linkError = (label: string) => new RegExp(`${label} must be an http:// or https:// link`);

// ── Prerequisites for the asset-bound registers ───────────────────────────────
const icsAssetName = uniq("IcsAsset");
const icsZoneName = uniq("IcsZone");
const patchAssetName = uniq("PatchAsset");
const ids: Record<string, string | undefined> = {};

const REGISTERS: Register[] = [
    {
        slug: "controls",
        entity: "Control",
        key: uniq("Control"),
        editedKey: uniq("Control-edited"),
        fields: [
            { label: "Framework", type: "select", value: "ISO 27001", edit: "SOC 2" },
            { label: "Control reference", type: "text", value: uniq("A.5.1") },
            { label: "Control name", type: "text", value: uniq("Control"), edit: uniq("Control-edited") },
            { label: "Description", type: "textarea", value: uniq("control description"), optional: true },
            { label: "Status", type: "select", value: "Partial", edit: "Implemented" },
            { label: "Review due", type: "date", value: isoDate(30), optional: true },
            { label: "Owner", type: "select", value: OWNER, optional: true },
            { label: "Last reviewed", type: "date", value: isoDate(-2), optional: true },
            { label: "Justification", type: "textarea", value: uniq("justification"), optional: true },
            { label: "Gap description", type: "textarea", value: uniq("gap"), optional: true },
            { label: "Remediation plan", type: "textarea", value: uniq("remediation"), optional: true },
            { label: "Evidence URL", type: "text", value: url("control-evidence"), optional: true },
        ],
        negative: [
            { field: "Control reference", value: overLength(64), error: /Control reference must be at most 64 characters/ },
            { field: "Evidence URL", value: JS_URL, error: linkError("Evidence URL") },
        ],
    },
    {
        slug: "risks",
        entity: "Risk",
        key: uniq("Risk"),
        editedKey: uniq("Risk-edited"),
        fields: [
            { label: "Risk title", type: "text", value: uniq("Risk"), edit: uniq("Risk-edited") },
            { label: "Description", type: "textarea", value: uniq("risk description"), optional: true },
            { label: "Framework", type: "select", value: "PCI DSS", optional: true },
            { label: "Risk ID", type: "text", value: uniq("RSK"), optional: true },
            { label: "Likelihood (1–5)", type: "number", value: 4, edit: 2 },
            { label: "Impact (1–5)", type: "number", value: 5, edit: 3 },
            { label: "Treatment", type: "select", value: "Transfer", edit: "Avoid" },
            { label: "Status", type: "select", value: "In treatment", edit: "Accepted" },
            { label: "Mitigation plan", type: "textarea", value: uniq("mitigation"), optional: true },
            { label: "Residual risk (1–25)", type: "number", value: 12, optional: true },
            { label: "Review date", type: "date", value: isoDate(60), optional: true },
            { label: "Owner", type: "select", value: OWNER, optional: true },
        ],
        negative: [
            { field: "Likelihood (1–5)", value: 6, error: /Likelihood \(1–5\) must be at most 5/ },
            { field: "Residual risk (1–25)", value: 26, error: /Residual risk \(1–25\) must be at most 25/ },
            { field: "Risk ID", value: overLength(32), error: /Risk ID must be at most 32 characters/ },
        ],
    },
    {
        slug: "incidents",
        entity: "Incident",
        key: uniq("Incident"),
        editedKey: uniq("Incident-edited"),
        fields: [
            { label: "Title", type: "text", value: uniq("Incident"), edit: uniq("Incident-edited") },
            { label: "Description", type: "textarea", value: uniq("incident description"), optional: true },
            { label: "Severity", type: "select", value: "High", edit: "Low" },
            { label: "Status", type: "select", value: "In progress", edit: "Resolved" },
            { label: "Category", type: "text", value: "Phishing", optional: true },
            { label: "Detected", type: "date", value: isoDate(-3), optional: true },
            // The edit moves the incident to Resolved, and the API stamps a resolved date
            // when a RESOLVED/CLOSED incident has none, so this field is changed, not cleared.
            { label: "Resolved", type: "date", value: isoDate(-1), edit: isoDate(-2), optional: true },
            { label: "Reported by", type: "select", value: OWNER, optional: true },
            { label: "Assigned to", type: "select", value: OWNER, optional: true },
            { label: "Root cause", type: "textarea", value: uniq("root cause"), optional: true },
            { label: "Lessons learned", type: "textarea", value: uniq("lessons"), optional: true },
        ],
        negative: [
            { field: "Title", value: overLength(255), error: /Title must be at most 255 characters/ },
            { field: "Category", value: overLength(64), error: /Category must be at most 64 characters/ },
        ],
    },
    {
        slug: "policies",
        entity: "Policy",
        key: uniq("Policy"),
        editedKey: uniq("Policy-edited"),
        fields: [
            { label: "Policy title", type: "text", value: uniq("Policy"), edit: uniq("Policy-edited") },
            { label: "Version", type: "text", value: "1.1", edit: "2.0" },
            { label: "Status", type: "select", value: "Under review", edit: "Approved" },
            { label: "Effective date", type: "date", value: isoDate(-10), optional: true },
            { label: "Review due", type: "date", value: isoDate(355), optional: true },
            { label: "Owner", type: "select", value: OWNER, optional: true },
            { label: "Approved by", type: "select", value: OWNER, optional: true },
            { label: "Document URL", type: "text", value: url("policy.pdf"), optional: true },
        ],
        negative: [
            { field: "Version", value: overLength(16), error: /Version must be at most 16 characters/ },
            { field: "Document URL", value: JS_URL, error: linkError("Document URL") },
        ],
    },
    {
        slug: "regulatory-filings",
        entity: "Filing",
        key: uniq("Filing"),
        editedKey: uniq("Filing-edited"),
        fields: [
            { label: "Filing type", type: "text", value: uniq("Filing"), edit: uniq("Filing-edited") },
            { label: "Regulator", type: "text", value: uniq("Reg"), edit: uniq("Reg2") },
            { label: "Due date", type: "date", value: isoDate(45), edit: isoDate(50) },
            { label: "Status", type: "select", value: "Submitted", edit: "Acknowledged" },
            { label: "Submitted", type: "date", value: isoDate(-1), optional: true },
            { label: "Reference", type: "text", value: uniq("Ref"), optional: true },
            { label: "Notes", type: "textarea", value: uniq("filing notes"), optional: true },
        ],
        negative: [
            { field: "Regulator", value: overLength(32), error: /Regulator must be at most 32 characters/ },
            { field: "Reference", value: overLength(128), error: /Reference must be at most 128 characters/ },
        ],
    },
    {
        // Finding counts are NOT NULL (default 0): zero is how a count is "cleared".
        slug: "vulnerability-scans",
        entity: "Scan",
        // The row shows the scanner tool (and the search covers it), so it is the key.
        key: uniq("Scanner"),
        editedKey: uniq("Scanner-edited"),
        fields: [
            { label: "Scan date", type: "date", value: isoDate(-2), edit: isoDate(-1) },
            { label: "Scan type", type: "select", value: "External", edit: "ICS / OT" },
            { label: "Scanner tool", type: "text", value: uniq("Scanner"), edit: uniq("Scanner-edited") },
            { label: "Status", type: "select", value: "Fail", edit: "Pass" },
            { label: "Critical", type: "number", value: 1, edit: 0, optional: true },
            { label: "High", type: "number", value: 2, edit: 0, optional: true },
            { label: "Medium", type: "number", value: 3, edit: 0, optional: true },
            { label: "Low", type: "number", value: 4, edit: 0, optional: true },
            { label: "Next scan due", type: "date", value: isoDate(90), optional: true },
            { label: "Report URL", type: "text", value: url("scan-report"), optional: true },
            { label: "Notes", type: "textarea", value: uniq("scan notes"), optional: true },
        ],
        negative: [
            { field: "Critical", value: -1, error: /Critical must be at least 0/ },
            { field: "Scanner tool", value: overLength(128), error: /Scanner tool must be at most 128 characters/ },
            { field: "Report URL", value: JS_URL, error: linkError("Report URL") },
        ],
    },
    {
        slug: "security-zones",
        entity: "Zone",
        key: uniq("Zone"),
        editedKey: uniq("Zone-edited"),
        fields: [
            { label: "Zone name", type: "text", value: uniq("Zone"), edit: uniq("Zone-edited") },
            // Option texts are "3 — Operations", "4 — Enterprise" (matched by containment).
            { label: "Purdue level", type: "select", value: "Operations", edit: "Enterprise" },
            { label: "Description", type: "textarea", value: uniq("zone description"), optional: true },
            { label: "Network range", type: "text", value: "10.99.0.0/16", optional: true },
            { label: "Allowed protocols", type: "text", value: "Modbus, OPC-UA", optional: true },
        ],
        negative: [
            { field: "Zone name", value: overLength(255), error: /Zone name must be at most 255 characters/ },
            { field: "Network range", value: overLength(255), error: /Network range must be at most 255 characters/ },
        ],
    },
    {
        slug: "ics-assets",
        entity: "ICS asset",
        // The row's main line is the linked asset's name.
        key: icsAssetName,
        setup: async ({ api }) => {
            ids.icsAsset = (await createAsset(api, icsAssetName)).id;
            ids.icsZone = (await api.post<{ id: string }>("/compliance/security-zones", { name: icsZoneName, purdueLevel: 1 })).id;
        },
        teardown: async ({ api }) => {
            if (ids.icsZone) await api.tryDelete(`/compliance/security-zones/${ids.icsZone}`);
            await dropAsset(api, ids.icsAsset);
        },
        fields: [
            // Locked on edit (disabled, sent unchanged); the prefill is still asserted.
            { label: "Asset", type: "select", value: icsAssetName },
            { label: "Security zone", type: "select", value: icsZoneName, optional: true },
            { label: "Firmware version", type: "text", value: "v1.2.3-e2e", optional: true },
            { label: "Protocol", type: "text", value: "Modbus TCP", optional: true },
            { label: "Vendor support", type: "select", value: "End of life", edit: "Supported" },
            { label: "Last patched", type: "date", value: isoDate(-20), optional: true },
            { label: "Known vulnerabilities", type: "textarea", value: uniq("CVE list"), optional: true },
            { label: "Network isolated", type: "checkbox", value: true, optional: true },
            { label: "Notes", type: "textarea", value: uniq("ics notes"), optional: true },
        ],
        negative: [
            { field: "Firmware version", value: overLength(64), error: /Firmware version must be at most 64 characters/ },
            { field: "Protocol", value: overLength(128), error: /Protocol must be at most 128 characters/ },
        ],
    },
    {
        slug: "patch-records",
        entity: "Patch record",
        key: uniq("Patch"),
        editedKey: uniq("Patch-edited"),
        setup: async ({ api }) => {
            ids.patchAsset = (await createAsset(api, patchAssetName)).id;
        },
        teardown: async ({ api }) => {
            await dropAsset(api, ids.patchAsset);
        },
        fields: [
            { label: "Asset", type: "select", value: patchAssetName },
            { label: "Patch name", type: "text", value: uniq("Patch"), edit: uniq("Patch-edited") },
            { label: "Version", type: "text", value: "1.0.0", optional: true },
            { label: "Status", type: "select", value: "Applied", edit: "Rolled back" },
            { label: "Applied", type: "date", value: isoDate(-1), optional: true },
            { label: "Validated in test environment", type: "checkbox", value: true, optional: true },
            { label: "Rollback plan", type: "textarea", value: uniq("rollback"), optional: true },
            { label: "Notes", type: "textarea", value: uniq("patch notes"), optional: true },
        ],
        negative: [
            { field: "Patch name", value: overLength(255), error: /Patch name must be at most 255 characters/ },
            { field: "Version", value: overLength(64), error: /Version must be at most 64 characters/ },
        ],
    },
    {
        slug: "pci-saq",
        entity: "SAQ record",
        // The requirement number is at most 16 characters: "E2E-<runId>".
        key: `E2E-${RUN_ID}`.slice(0, 16),
        canDelete: false,
        fields: [
            { label: "Requirement", type: "text", value: `E2E-${RUN_ID}`.slice(0, 16) },
            { label: "Answer", type: "select", value: "Compensating control", edit: "Not applicable" },
            { label: "Requirement text", type: "textarea", value: uniq("requirement text"), optional: true },
            { label: "Compensating control", type: "textarea", value: uniq("compensating"), optional: true },
            { label: "Target date", type: "date", value: isoDate(30), optional: true },
            { label: "Evidence URL", type: "text", value: url("saq-evidence"), optional: true },
            { label: "Notes", type: "textarea", value: uniq("saq notes"), optional: true },
        ],
        negative: [
            { field: "Requirement", value: overLength(16), error: /Requirement must be at most 16 characters/ },
            { field: "Evidence URL", value: JS_URL, error: linkError("Evidence URL") },
        ],
    },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const reg of REGISTERS) {
    const lower = escape(reg.entity.toLowerCase());
    describeRoundTrip({
        title: `Compliance ${reg.slug}`,
        path: `/compliance/${reg.slug}`,
        key: reg.key,
        editedKey: reg.editedKey,
        createButton: new RegExp(`^New ${escape(reg.entity)}$`, "i"),
        editButton: new RegExp(`^Edit ${lower}$`, "i"),
        deleteButton: new RegExp(`^Delete ${lower}$`, "i"),
        searchPlaceholder: /^Search…$/,
        fields: reg.fields,
        negative: reg.negative,
        setup: reg.setup,
        teardown: reg.teardown,
        remove: reg.canDelete === false ? false : undefined,
    });
}

// ── SLA metrics: validation only ──────────────────────────────────────────────
// No delete in the UI or the API, and a record is keyed by (month, year) of the
// real tenant, so a round trip would leave a permanent, unprefixable SLA figure.
// The limits are still checked on the create form, which is never submitted valid.
test.describe("Compliance sla-metrics (validation only)", () => {
    const cases: { label: string; value: number; error: RegExp }[] = [
        { label: "Month (1–12)", value: 13, error: /Month \(1–12\) must be at most 12/ },
        { label: "Year", value: 1999, error: /Year must be at least 2000/ },
        { label: "Uptime %", value: 100.5, error: /Uptime % must be at most 100/ },
        { label: "Incidents", value: -1, error: /Incidents must be at least 0/ },
        { label: "RTO (min)", value: -5, error: /RTO \(min\) must be at least 0/ },
    ];
    for (const [index, c] of cases.entries()) {
        test(`e${index + 1}) inline error for invalid "${c.label}"`, async ({ page }) => {
            await page.goto("/compliance/sla-metrics");
            await page.getByRole("button", { name: /^New SLA metric$/i }).first().click();
            const form = formModal(page);
            await expect(form).toBeVisible();
            const spec: FieldSpec = { label: c.label, type: "number", value: c.value };
            const control = await fieldControl(form, spec);
            await bypassNativeValidation(form, control);
            await setControl(control, spec, c.value);
            await form.getByRole("button", { name: /^Create sla metric$/i }).click();
            await expect(form.getByRole("alert").filter({ hasText: c.error }).first()).toBeVisible();
            await expect(form, "the form stays open").toBeVisible();
            await form.getByRole("button", { name: /^Cancel$/ }).click();
            await expect(form).toBeHidden();
        });
    }
});
