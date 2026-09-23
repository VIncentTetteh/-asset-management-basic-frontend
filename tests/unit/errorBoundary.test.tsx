import { Component, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RouteError from "@/app/error";
import NotFound from "@/app/not-found";
import { ErrorScreen } from "@/components/errors/ErrorScreen";
import { CHUNK_RELOAD_KEY } from "@/lib/chunk-recovery";

/**
 * The recovery UI, exercised the way a user meets it: a component that throws
 * during render, caught by a boundary, with the fallback on screen and its
 * buttons clicked for real.
 *
 * `src/app/error.tsx` is the fallback Next renders into its own boundary, so
 * rendering it directly is rendering the production component — the local
 * `Boundary` below only supplies the throw that Next would have caught.
 */

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

/** Stand-in for the boundary Next.js puts around a route segment. */
class Boundary extends Component<
    { children: ReactNode; fallback: (error: Error, retry: () => void) => ReactNode },
    { error: Error | null }
> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return this.props.fallback(this.state.error, () => this.setState({ error: null }));
        }
        return this.props.children;
    }
}

/**
 * Throws while `gate.throws` is set. The gate is flipped by the test, never by
 * rendering: React 19 re-runs a failed concurrent render synchronously, so a
 * component that counted its own renders would "recover" on its own and the
 * boundary would never be reached.
 */
function FlakyPage({ gate }: { gate: { throws: boolean } }) {
    if (gate.throws) {
        throw new Error("Cannot read properties of undefined (reading 'assetTag')");
    }
    return <p>Assets loaded</p>;
}

let reload: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    window.sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, reload, pathname: "/assets", search: "" },
    });
    // React logs every caught render error; the boundary tests throw on purpose.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
    cleanup();
    window.sessionStorage.clear();
});

describe("a thrown render", () => {
    it("is caught and replaced with recovery UI, not a blank screen", () => {
        render(
            <Boundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>
                <FlakyPage gate={{ throws: true }} />
            </Boundary>,
        );

        expect(screen.getByTestId("error-screen").getAttribute("data-error-kind")).toBe("unknown");
        expect(screen.getByRole("alert").textContent).toContain("This page didn't load");
        expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
        expect(screen.getByRole("link", { name: /go to dashboard/i }).getAttribute("href")).toBe("/dashboard");
    });

    it("never shows the user the exception text", () => {
        render(
            <Boundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>
                <FlakyPage gate={{ throws: true }} />
            </Boundary>,
        );

        expect(document.body.textContent).not.toContain("assetTag");
        expect(document.body.textContent).not.toContain("Cannot read properties");
    });

    it("recovers when the retry succeeds", () => {
        const gate = { throws: true };
        render(
            <Boundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>
                <FlakyPage gate={gate} />
            </Boundary>,
        );

        expect(screen.getByTestId("error-screen")).toBeTruthy();

        // Whatever was broken is now fixed — a backend recovered, a race lost
        // its window. The retry has to actually re-render the children.
        gate.throws = false;
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));

        expect(screen.getByText("Assets loaded")).toBeTruthy();
        expect(screen.queryByTestId("error-screen")).toBeNull();
        // A re-render, not a document reload: state elsewhere on the page survives.
        expect(reload).not.toHaveBeenCalled();
    });

    it("moves focus to the heading so a screen reader is told something happened", () => {
        render(<ErrorScreen error={new Error("boom")} onRetry={() => {}} />);
        expect(document.activeElement).toBe(screen.getByRole("alert"));
    });

    it("reports the failure rather than swallowing it", () => {
        render(
            <Boundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>
                <FlakyPage gate={{ throws: true }} />
            </Boundary>,
        );
        // React logs its own noise around a caught error; what matters is that
        // ours is in there and the failure was not swallowed.
        const reported = consoleError.mock.calls.some(
            ([label, detail]: [unknown, unknown]) =>
                label === "Route render failed"
                && typeof (detail as { message?: unknown })?.message === "string"
                && (detail as { message: string }).message.includes("assetTag"),
        );
        expect(reported).toBe(true);
    });
});

describe("a stale-chunk render failure", () => {
    function chunkError(): Error {
        const error = new Error("Loading chunk 812 failed.");
        error.name = "ChunkLoadError";
        return error;
    }

    it("reloads once instead of showing anything, and shows no error screen while it does", () => {
        render(<RouteError error={chunkError()} retry={vi.fn()} />);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("error-screen")).toBeNull();
        expect(screen.getByRole("status").textContent).toMatch(/updating assetiq/i);
    });

    it("shows the error screen — and does not reload again — when the reload did not help", () => {
        // The marker a moment ago is the previous attempt.
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));

        render(<RouteError error={chunkError()} retry={vi.fn()} />);

        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByTestId("error-screen").getAttribute("data-error-kind")).toBe("stale-build");
        expect(screen.getByRole("alert").textContent).toMatch(/updated while this tab was open/i);
    });

    it("reloads rather than re-rendering when the user presses the button, because re-rendering cannot fetch a missing chunk", () => {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        const retry = vi.fn();
        render(<RouteError error={chunkError()} retry={retry} />);

        fireEvent.click(screen.getByRole("button", { name: /reload the page/i }));

        expect(reload).toHaveBeenCalledTimes(1);
        expect(retry).not.toHaveBeenCalled();
    });
});

describe("offline", () => {
    it("is named as its own condition, not reported as a broken page", () => {
        const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        try {
            render(<ErrorScreen error={new Error("Network Error")} onRetry={vi.fn()} />);
            expect(screen.getByTestId("error-screen").getAttribute("data-error-kind")).toBe("offline");
            expect(screen.getByRole("alert").textContent).toMatch(/offline/i);
        } finally {
            onLine.mockRestore();
        }
    });
});

describe("not-found", () => {
    it("offers a way back instead of a bare 404", () => {
        render(<NotFound />);
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading.textContent).toMatch(/couldn.t find that page/i);
        expect(document.activeElement).toBe(heading);
        expect(screen.getByRole("link", { name: /go to dashboard/i }).getAttribute("href")).toBe("/dashboard");
    });
});

describe("the boundary is not the first line of defence", () => {
    it("an event-handler failure is handled in place and leaves the route standing", () => {
        // React error boundaries do not catch errors in event handlers
        // (node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md),
        // which is exactly why a failed action must report itself rather than
        // relying on a boundary that will never see it.
        function SaveButton() {
            const [failed, setFailed] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setFailed(true)}>Save</button>
                    {failed ? <p role="alert">We couldn&apos;t save that. Try again.</p> : null}
                    <p>Asset form</p>
                </>
            );
        }

        render(
            <Boundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>
                <SaveButton />
            </Boundary>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(screen.getByRole("alert").textContent).toMatch(/couldn.t save that/i);
        expect(screen.getByText("Asset form")).toBeTruthy();
        expect(screen.queryByTestId("error-screen")).toBeNull();
    });
});
