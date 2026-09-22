import { uniq } from "../../fixtures/auth";
import type { FieldSpec } from "../../fixtures/forms";
import { createSupplier, dropSupplier, isoDate } from "../../fixtures/prereqs";
import { describeRoundTrip } from "../../fixtures/roundtrip";
import { dropWhere } from "./_leases-licenses-helpers";

// src/app/vendor-reviews/page.tsx: a review belongs to a supplier (a picker,
// disabled on edit), so a fresh supplier is created and the review's row is
// found by that supplier's name. The overall rating is derived from the three
// sub-scores and is not an input.
const supplier = uniq("ReviewSupplier");
let supplierId: string | undefined;

// Score labels read "Quality (1–5) *" (an en dash).
const quality: FieldSpec = { label: "Quality (1\u20135)", type: "number", value: 4, edit: 2 };
const delivery: FieldSpec = { label: "Delivery (1\u20135)", type: "number", value: 3, edit: 5 };
const support: FieldSpec = { label: "Support (1\u20135)", type: "number", value: 5, edit: 3 };

describeRoundTrip({
    title: "Vendor reviews",
    path: "/vendor-reviews",
    key: supplier,
    createButton: /^Add review$/i,
    editButton: /^Edit review$/i,
    deleteButton: /^Delete review$/i,
    setup: async ({ api }) => {
        supplierId = (await createSupplier(api, supplier)).id;
    },
    teardown: async ({ api }) => {
        if (supplierId) {
            await dropWhere<{ id?: string; supplierId?: string }>(
                api,
                await api.withOrg(`/vendor-reviews?supplierId=${supplierId}`),
                (review) => review.supplierId === supplierId,
                async (id) => api.withOrg(`/vendor-reviews/${id}`),
            );
        }
        await dropSupplier(api, supplierId);
    },
    fields: [
        // Disabled on edit: asserted in the prefill, never changed.
        { label: "Supplier", type: "select", value: supplier },
        quality,
        delivery,
        support,
        { label: "Period start", type: "date", value: isoDate(-90), edit: isoDate(-60) },
        { label: "Period end", type: "date", value: isoDate(-1), edit: isoDate(-2) },
        { label: "Feedback", type: "textarea", value: uniq("review feedback"), optional: true },
    ],
    negative: [
        { field: quality, value: 6, error: /Quality must be at most 5/ },
        { field: delivery, value: 0, error: /Delivery must be at least 1/ },
    ],
});
