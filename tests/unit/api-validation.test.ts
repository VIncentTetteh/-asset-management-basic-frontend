import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ toast: toastMock, default: toastMock }));

import {
    applyApiFieldErrors,
    describeFieldErrors,
    DUPLICATE,
    getApiErrorCode,
    getApiFieldErrors,
    humaniseField,
    reportApiError,
    reportFormErrors,
} from "@/lib/api-validation";
import { StepUpCancelledError } from "@/lib/step-up";

const apiError = (status: number, data: unknown): AxiosError => {
    const response = { status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
    return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, response);
};

/** GlobalExceptionHandler.handleMethodArgumentNotValid's body shape. */
const validationFailed = (errors: Record<string, string>) =>
    apiError(400, { status: 400, message: "Validation failed", errorCode: "VALIDATION_FAILED", errors });

describe("getApiFieldErrors", () => {
    it("reads the errors map of a validation failure", () => {
        expect(getApiFieldErrors(validationFailed({ periodStart: "must not be null" }))).toEqual({
            periodStart: "must not be null",
        });
    });

    it("is empty for other errors", () => {
        expect(getApiFieldErrors(apiError(409, { message: "Insufficient funds" }))).toEqual({});
        expect(getApiFieldErrors(new Error("boom"))).toEqual({});
        expect(getApiFieldErrors(apiError(400, { errors: ["not", "a", "map"] }))).toEqual({});
    });
});

describe("field labels", () => {
    it("humanises camelCase and nested paths", () => {
        expect(humaniseField("periodStart")).toBe("Period start");
        expect(humaniseField("lines[0].unitCost")).toBe("Unit cost");
        expect(humaniseField("alert_threshold")).toBe("Alert threshold");
    });

    it("prefers explicit labels", () => {
        expect(describeFieldErrors({ notes: "too long", endDate: "must not be null" }, { notes: "Key terms" })).toEqual([
            "Key terms: too long",
            "End date: must not be null",
        ]);
    });
});

describe("reportApiError", () => {
    beforeEach(() => {
        toastMock.error.mockClear();
    });

    it("puts each server message on its form field and lists them in one toast", () => {
        const setError = vi.fn();
        const handled = reportApiError(
            validationFailed({ periodStart: "must not be null", periodEnd: "must not be null" }),
            { fallback: "Failed to save budget", setError },
        );

        expect(handled).toBe(true);
        expect(setError).toHaveBeenCalledWith("periodStart", { type: "server", message: "must not be null" });
        expect(setError).toHaveBeenCalledWith("periodEnd", { type: "server", message: "must not be null" });
        expect(toastMock.error).toHaveBeenCalledTimes(1);
        const text = toastMock.error.mock.calls[0][0] as string;
        expect(text).toContain("Period start: must not be null");
        expect(text).toContain("Period end: must not be null");
        expect(text).not.toContain("Failed to save budget");
    });

    it("maps API field names onto differently named form fields", () => {
        const setError = vi.fn();
        reportApiError(validationFailed({ name: "License name is required" }), {
            fallback: "x",
            setError,
            fieldMap: { name: "productName" },
        });
        expect(setError).toHaveBeenCalledWith("productName", expect.objectContaining({ message: "License name is required" }));
    });

    it("shows the server's message for non-validation failures", () => {
        const handled = reportApiError(
            apiError(409, { message: "Insufficient funds in budget 'IT': 100.00 GHS available", errorCode: "CONFLICT" }),
            { fallback: "Failed to approve purchase order" },
        );
        expect(handled).toBe(false);
        expect(toastMock.error).toHaveBeenCalledWith("Insufficient funds in budget 'IT': 100.00 GHS available");
    });

    it("falls back when the server gives no message", () => {
        reportApiError(apiError(500, {}), { fallback: "Failed to save lease" });
        expect(toastMock.error).toHaveBeenCalledWith("Failed to save lease");
    });

    it("defers to the step-up handling when the MFA prompt was cancelled", () => {
        reportApiError(new StepUpCancelledError(), { fallback: "Failed to approve" });
        expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("cancelled"), expect.anything());
    });
});

describe("applyApiFieldErrors", () => {
    it("marks fields without toasting", () => {
        toastMock.error.mockClear();
        const setError = vi.fn();
        expect(applyApiFieldErrors(validationFailed({ startDate: "must not be null" }), setError)).toBe(1);
        expect(setError).toHaveBeenCalledWith("startDate", { type: "server", message: "must not be null" });
        expect(toastMock.error).not.toHaveBeenCalled();
    });
});

describe("database integrity errors (GlobalExceptionHandler SQLState split)", () => {
    beforeEach(() => {
        toastMock.error.mockClear();
    });

    it("puts a DUPLICATE field on the form", () => {
        const error = apiError(409, {
            status: 409,
            errorCode: "DUPLICATE",
            message: "A record with this asset tag already exists",
            errors: { assetTag: "already in use" },
        });
        const setError = vi.fn();

        expect(getApiErrorCode(error)).toBe(DUPLICATE);
        expect(reportApiError(error, { fallback: "Failed", setError })).toBe(true);
        expect(setError).toHaveBeenCalledWith("assetTag", { type: "server", message: "already in use" });
        expect(toastMock.error).toHaveBeenCalledWith("Please fix this field:\nAsset tag: already in use");
    });

    it("puts a NOT NULL column on its field", () => {
        const error = apiError(400, {
            status: 400,
            errorCode: "VALIDATION_FAILED",
            message: "Category id is required",
            errors: { categoryId: "is required" },
        });
        const setError = vi.fn();

        expect(applyApiFieldErrors(error, setError, { categoryId: "category" })).toBe(1);
        expect(setError).toHaveBeenCalledWith("category", { type: "server", message: "is required" });
    });

    it("toasts the message when no field is known", () => {
        const error = apiError(400, {
            status: 400,
            errorCode: "VALUE_TOO_LONG",
            message: "A value is too long for its field",
        });

        expect(reportApiError(error, { fallback: "Failed" })).toBe(false);
        expect(toastMock.error).toHaveBeenCalledWith("A value is too long for its field");
    });
});

describe("reportFormErrors", () => {
    beforeEach(() => toastMock.error.mockClear());

    it("names every field react-hook-form refused to submit on", () => {
        reportFormErrors({
            poNumber: { type: "required", message: "PO number is required" },
            totalAmount: { type: "min", message: "Total amount must be at least 0.01" },
        } as never);
        expect(toastMock.error).toHaveBeenCalledTimes(1);
        const message = String(toastMock.error.mock.calls[0][0]);
        expect(message).toContain("Please fix these fields:");
        expect(message).toContain("Po number: PO number is required");
        expect(message).toContain("Total amount: Total amount must be at least 0.01");
    });

    it("reaches into field arrays, where the row that failed may be scrolled out of sight", () => {
        reportFormErrors({
            lineItems: [undefined, { quantity: { type: "min", message: "Quantity must be at least 0.0001" } }],
        } as never);
        expect(String(toastMock.error.mock.calls[0][0])).toContain("Quantity: Quantity must be at least 0.0001");
    });

    it("falls back to a message when a rule was registered without one", () => {
        reportFormErrors({ name: { type: "required" } } as never);
        expect(String(toastMock.error.mock.calls[0][0])).toContain("Name: is invalid");
    });

    it("still says something when the error tree is empty, so a refused save is never silent", () => {
        reportFormErrors({} as never);
        expect(toastMock.error).toHaveBeenCalledWith("Some fields need fixing before this can be saved");
    });
});
