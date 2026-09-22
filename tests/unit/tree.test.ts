import { describe, expect, it } from "vitest";
import { allowedTreeParents } from "@/lib/tree";

type Cat = { id: string; parentCategoryId?: string | null };
const cats: Cat[] = [
    { id: "hw" },
    { id: "laptops", parentCategoryId: "hw" },
    { id: "ultra", parentCategoryId: "laptops" },
    { id: "13in", parentCategoryId: "ultra" },
    { id: "sw" },
];
const parentOf = (c: Cat) => c.parentCategoryId;

describe("allowedTreeParents", () => {
    it("excludes the category itself and every sub-category", () => {
        expect([...allowedTreeParents(cats, "laptops", parentOf)].sort()).toEqual(["hw", "sw"]);
    });

    it("allows everything for a new category", () => {
        expect(allowedTreeParents(cats, undefined, parentOf).size).toBe(5);
    });

    it("terminates on a stored cycle", () => {
        const cyclic: Cat[] = [{ id: "a", parentCategoryId: "b" }, { id: "b", parentCategoryId: "a" }, { id: "c" }];
        expect([...allowedTreeParents(cyclic, "a", parentOf)]).toEqual(["c"]);
    });
});
