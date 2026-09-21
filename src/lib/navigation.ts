/**
 * Full-page navigation to an external URL (e.g. a payment provider). Kept in
 * its own module so tests can observe it without redefining window.location.
 */
export const redirectTo = (url: string): void => {
    window.location.assign(url);
};
