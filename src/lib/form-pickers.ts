/**
 * Whether a form's picker lists have arrived, so it is safe to prefill it.
 *
 * A `<select>` can only hold a value that exists as one of its `<option>`s. Every
 * edit form here fills itself with `reset()` in an effect that fires as the modal
 * opens, while the lists behind its pickers are still separate, still-running
 * react-query fetches. When one of those has not landed, the select is nothing but
 * its placeholder, the browser drops the value `reset()` gave it, and react-hook-form
 * takes the empty string as the field's value — permanently, because nothing re-runs
 * when the options turn up moments later.
 *
 * That is not theoretical: on staging a purchase order's `GET /purchase-orders`
 * answered before `GET /suppliers`, so reopening an order for edit showed "Select
 * supplier" and saving was refused with "Supplier is required" — an order that could
 * not be edited at all until the page was reloaded at the right moment.
 *
 * So a form that prefills a picker waits for it: gate both the `reset()` effect and
 * the form's own render on this, and show a spinner until it is true.
 *
 *     const pickersReady = formPickersReady(suppliersQuery, departmentsQuery);
 *     useEffect(() => {
 *         if (!isModalOpen || !pickersReady) return;
 *         reset(…);
 *     }, [isModalOpen, editing, reset, pickersReady]);
 *
 * Only the first load matters. Once a query holds data it is no longer pending, even
 * while it refetches, so this never flips back to false and cannot wipe a form the
 * user is already typing into.
 */
export function formPickersReady(...queries: readonly { isPending: boolean }[]): boolean {
    return queries.every((query) => !query.isPending);
}
