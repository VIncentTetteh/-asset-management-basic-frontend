import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { PurchaseOrderLineItems } from "@/features/finance/PurchaseOrderLineItems";
import type { PurchaseOrderForm } from "@/features/finance/payloads";

afterEach(cleanup);

const money = (amount: number) => `GHS ${amount.toFixed(2)}`;

function Harness({ initial }: { initial?: PurchaseOrderForm["lineItems"] }) {
    const { control, register, formState: { errors } } = useForm<PurchaseOrderForm>({
        defaultValues: { lineItems: initial ?? [] },
    });
    return (
        <form>
            <PurchaseOrderLineItems
                control={control}
                register={register}
                errors={errors.lineItems as never}
                categories={[{ id: "cat-1", name: "Laptops" }]}
                formatMoney={money}
            />
        </form>
    );
}

describe("purchase order line items editor", () => {
    it("starts empty and says so — an order may be a lump sum", () => {
        render(<Harness />);
        expect(screen.getByText(/single lump sum/i)).toBeTruthy();
        expect(screen.queryAllByTestId("po-line-row")).toHaveLength(0);
    });

    it("adds and removes rows", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("po-add-line"));
        fireEvent.click(screen.getByTestId("po-add-line"));
        expect(screen.getAllByTestId("po-line-row")).toHaveLength(2);

        fireEvent.click(screen.getByTestId("po-remove-line-0"));
        expect(screen.getAllByTestId("po-line-row")).toHaveLength(1);
    });

    it("prefills an existing order's lines", () => {
        render(<Harness initial={[{ description: "Dell Latitude", quantity: 2, unitPrice: 1200, taxRate: 12.5 }]} />);
        expect((screen.getByLabelText(/^Description/) as HTMLInputElement).value).toBe("Dell Latitude");
        expect((screen.getByLabelText(/^Quantity/) as HTMLInputElement).value).toBe("2");
        expect(screen.getByTestId("po-line-total-0").textContent).toBe(money(2700));
        expect(screen.getByTestId("po-lines-total").textContent).toBe(money(2700));
    });

    it("recomputes the line and order totals as the user types", () => {
        render(<Harness initial={[{ description: "A", quantity: 1, unitPrice: 10 }]} />);
        expect(screen.getByTestId("po-line-total-0").textContent).toBe(money(10));

        fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "4" } });
        expect(screen.getByTestId("po-line-total-0").textContent).toBe(money(40));

        fireEvent.change(screen.getByLabelText(/^Tax %/), { target: { value: "10" } });
        expect(screen.getByTestId("po-line-total-0").textContent).toBe(money(44));
        expect(screen.getByTestId("po-lines-total").textContent).toBe(money(44));
    });

    it("mirrors the backend column limits on the inputs", () => {
        render(<Harness initial={[{ description: "A", quantity: 1, unitPrice: 1 }]} />);
        const description = screen.getByLabelText(/^Description/) as HTMLInputElement;
        expect(description.maxLength).toBe(500);
        const quantity = screen.getByLabelText(/^Quantity/) as HTMLInputElement;
        // @DecimalMin(0, inclusive = false) at NUMERIC(15,4).
        expect(quantity.min).toBe("0.0001");
        expect(quantity.step).toBe("0.0001");
        const price = screen.getByLabelText(/^Unit price/) as HTMLInputElement;
        expect(price.min).toBe("0");
    });

    it("offers the tenant's categories, plus none", () => {
        render(<Harness initial={[{ description: "A", quantity: 1, unitPrice: 1 }]} />);
        const options = Array.from((screen.getByLabelText(/^Category/) as HTMLSelectElement).options)
            .map((option) => option.textContent);
        expect(options).toEqual(["No category", "Laptops"]);
    });

    it("locks every control once the order has left draft", () => {
        const { container } = render(
            <form>
                <LockedHarness />
            </form>,
        );
        for (const input of Array.from(container.querySelectorAll("input, select, button"))) {
            expect((input as HTMLInputElement).disabled).toBe(true);
        }
    });
});

function LockedHarness() {
    const { control, register } = useForm<PurchaseOrderForm>({
        defaultValues: { lineItems: [{ description: "Locked", quantity: 1, unitPrice: 10 }] },
    });
    return (
        <PurchaseOrderLineItems
            control={control}
            register={register}
            categories={[]}
            formatMoney={money}
            disabled
        />
    );
}
