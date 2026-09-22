import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FIELD_LIMITS, fieldLimit, isAcceptableUrl, limitInputProps, limitRules } from "@/lib/field-limits";
import { FieldError } from "@/components/ui/field-error";

describe("FIELD_LIMITS mirrors the backend DTOs", () => {
    it("carries column lengths that differ from the 255 default", () => {
        expect(fieldLimit("regulatoryFiling", "regulator")).toEqual({ required: true, maxLength: 32 });
        expect(fieldLimit("securityPolicy", "version").maxLength).toBe(16);
        expect(fieldLimit("pciSaq", "requirementNumber").maxLength).toBe(16);
        expect(fieldLimit("exchangeRate", "source").maxLength).toBe(50);
        expect(fieldLimit("asset", "costCenter").maxLength).toBe(100);
    });

    it("keeps money at two decimals and positive amounts above zero", () => {
        expect(FIELD_LIMITS.expense.amount).toMatchObject({ required: true, min: 0.01, step: 0.01 });
        expect(FIELD_LIMITS.lease.monthlyPayment).toMatchObject({ required: true, min: 0.01 });
        expect(FIELD_LIMITS.asset.purchaseCost).toMatchObject({ min: 0, step: 0.01 });
    });

    it("is empty for fields the backend does not limit", () => {
        expect(fieldLimit("asset", "description")).toEqual({});
    });
});

describe("limitInputProps", () => {
    it("maps limits to HTML attributes", () => {
        expect(limitInputProps({ required: true, maxLength: 32 })).toEqual({ maxLength: 32 });
        expect(limitInputProps({ min: 1, max: 5, step: 1 })).toEqual({ min: 1, max: 5, step: 1 });
    });
});

describe("limitRules", () => {
    it("gives every rule a message", () => {
        const rules = limitRules({ required: true, maxLength: 32, min: 1, max: 5, minLength: 2 }, "Regulator");
        expect(rules.required).toBe("Regulator is required");
        expect(rules.maxLength).toEqual({ value: 32, message: "Regulator must be at most 32 characters" });
        expect(rules.minLength).toEqual({ value: 2, message: "Regulator must be at least 2 characters" });
        expect(rules.min).toEqual({ value: 1, message: "Regulator must be at least 1" });
        expect(rules.max).toEqual({ value: 5, message: "Regulator must be at most 5" });
    });

    it("rejects whitespace-only required text, like @NotBlank", () => {
        const validate = limitRules({ required: true, maxLength: 255 }, "Name").validate as (v: unknown) => unknown;
        expect(validate("   ")).toBe("Name is required");
        expect(validate("Laptop")).toBe(true);
    });

    it("sets nothing for an unlimited field", () => {
        expect(limitRules({}, "Notes")).toEqual({});
    });
});

describe("FieldError", () => {
    afterEach(cleanup);

    it("renders the error message", () => {
        render(<FieldError error={{ message: "already in use" }} />);
        expect(screen.getByRole("alert").textContent).toBe("already in use");
    });

    it("falls back when the rule had no message", () => {
        render(<FieldError error={{ message: "" }} fallback="Title is required" />);
        expect(screen.getByRole("alert").textContent).toBe("Title is required");
    });

    it("renders nothing without an error", () => {
        const { container } = render(<FieldError error={undefined} />);
        expect(container.innerHTML).toBe("");
    });
});

describe("URL fields mirror @HttpUrl", () => {
    it("accepts blank or absolute http(s) links only", () => {
        expect(isAcceptableUrl("")).toBe(true);
        expect(isAcceptableUrl("https://docs.example.com/a.pdf")).toBe(true);
        expect(isAcceptableUrl("javascript:alert(1)")).toBe(false);
        expect(isAcceptableUrl(" \u0001JaVa\tScript:alert(1)")).toBe(false);
        expect(isAcceptableUrl("data:text/html,x")).toBe(false);
        expect(isAcceptableUrl("relative.pdf")).toBe(false);
    });

    it("lets a reference field hold plain text but never a script URL", () => {
        expect(isAcceptableUrl("Certificate #12345", true)).toBe(true);
        expect(isAcceptableUrl("Ref: 12", true)).toBe(true);
        expect(isAcceptableUrl("vbscript:x", true)).toBe(false);
    });

    it("puts the check on every link field's rules", () => {
        const rules = limitRules(FIELD_LIMITS.contract.documentUrl, "Document URL");
        const validate = rules.validate as (v: unknown) => true | string;
        expect(validate("javascript:alert(1)")).toBe("Document URL must be an http:// or https:// link");
        expect(validate("https://x.example/y")).toBe(true);
        expect(FIELD_LIMITS.disposal.complianceDocumentUrl.url).toBe("httpOrText");
        expect(FIELD_LIMITS.expense.receiptUrl.url).toBe("http");
    });
});
