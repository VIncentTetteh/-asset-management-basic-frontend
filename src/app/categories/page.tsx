"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Tags, Search } from "lucide-react";
import type { Category, CategoryDto } from "@/types";
import { categoryService } from "@/services/categoryService";
import { makeCrudHooks } from "@/features/shared/crudHooks";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { buildCategoryUpdate, normaliseCategoryForm } from "@/features/categories/categoryPayload";
import { allowedTreeParents } from "@/lib/tree";
import { useConfirm } from "@/hooks/useConfirm";
import { useDepreciationPolicies } from "@/features/depreciation/hooks";
import { depreciationMethodLabel, usefulLifeLabel } from "@/features/assets/depreciation";
import { ImportButton } from "@/features/imports/ImportButton";

const categories = makeCrudHooks<Category, CategoryDto>("categories", categoryService, { entity: "Category" });

export default function CategoriesPage() {
  const { data: rows = [], isLoading, error, refetch, isFetching } = categories.useList();
  const save = categories.useSave();
  const remove = categories.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();
  // Listing policies needs VIEW_DEPRECIATION; without it an assigned policy shows as "Assigned".
  const { data: policies = [] } = useDepreciationPolicies();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<CategoryDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            description: editing.description || "",
            assetPrefixCode: editing.assetPrefixCode || "",
            parentCategoryId: editing.parentCategoryId || "",
            depreciationPolicyId: editing.depreciationPolicyId || "",
            defaultWarrantyPeriodMonths: editing.defaultWarrantyPeriodMonths,
          }
        : {
            name: "",
            description: "",
            assetPrefixCode: "",
            parentCategoryId: "",
            depreciationPolicyId: "",
            defaultWarrantyPeriodMonths: undefined,
          },
    );
  }, [isModalOpen, editing, reset]);

  const parentOptions = useMemo(
    () => allowedTreeParents(rows, editing?.id, (c) => c.parentCategoryId),
    [rows, editing?.id],
  );

  const parentName = useMemo(() => {
    const map = new Map(rows.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [rows]);

  const policyById = useMemo(() => new Map(policies.map((p) => [p.id, p])), [policies]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((c) => c.name.toLowerCase().includes(q) || (c.assetPrefixCode || "").toLowerCase().includes(q));
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (cat: Category) => {
    if (!(await confirm({ message: `Delete "${cat.name}"?`, variant: "danger" }))) return;
    remove.mutate(cat.id!);
  };

  const onSubmit = async (data: CategoryDto) => {
    try {
      if (editing) {
        // Emptied optional fields are sent as explicit clears; untouched ones are omitted.
        const patch = buildCategoryUpdate(editing, data);
        if (Object.keys(patch).length === 0) {
          toast("No changes to update");
          return;
        }
        await save.mutateAsync({ id: editing.id, data: patch as CategoryDto });
      } else {
        await save.mutateAsync({ data: normaliseCategoryForm(data) });
      }
      setIsModalOpen(false);
    } catch (error) {
      // The save hook already toasted the reason; put field errors on their inputs.
      applyApiFieldErrors(error, setError);
    }
  };

  const columns = useMemo<ColumnDef<Category, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Category",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            {row.original.description ? (
              <p className="truncate text-xs text-faint-fg">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "assetPrefixCode",
        header: "Prefix",
        cell: ({ row }) =>
          row.original.assetPrefixCode ? (
            <span className="data-mono text-xs">{row.original.assetPrefixCode}</span>
          ) : (
            <span className="text-faint-fg">—</span>
          ),
      },
      {
        id: "parent",
        header: "Parent",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{parentName(row.original.parentCategoryId)}</span>,
      },
      {
        id: "depreciationPolicy",
        header: "Depreciation policy",
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.depreciationPolicyId;
          const policy = id ? policyById.get(id) : undefined;
          if (!id) return <span className="text-faint-fg">None</span>;
          if (!policy) return <span className="text-muted-fg">Assigned</span>;
          return (
            <div className="min-w-0 max-w-56">
              <p className="truncate font-medium text-foreground">{policy.name}</p>
              <p className="truncate text-xs text-faint-fg">
                {depreciationMethodLabel(policy.method)} · {usefulLifeLabel(policy.usefulLifeMonths)}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "defaultWarrantyPeriodMonths",
        header: () => <span className="block text-right">Warranty (mo)</span>,
        cell: ({ row }) => (
          <span className="data-mono block text-right">{row.original.defaultWarrantyPeriodMonths ?? "—"}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit category"
              onClick={() => {
                setEditing(row.original);
                setIsModalOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-danger"
              aria-label="Delete category"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentName, policyById],
  );

  return (
    <ListPageTemplate
      title="Categories"
      subtitle={isLoading ? "Loading categories…" : error ? "Couldn't load right now" : `${rows.length} asset categories`}
      actions={
        <>
          <ImportButton type="categories" />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New category
          </Button>
        </>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input placeholder="Search name or prefix…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat="your categories"
        emptyTitle="No categories yet"
        emptyDescription="Organise assets into categories. A prefix code numbers new asset tags and a default warranty fills in warranty expiry."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Tags className="mr-1.5 h-4 w-4" /> New category
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit category" : "New category"}
        description="Categories group assets and can nest under a parent category."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name <span className="text-danger">*</span></Label>
            <Input
              id="cat-name"
              placeholder="Laptops"
              {...limitInputProps(FIELD_LIMITS.category.name)}
              {...register("name", limitRules<CategoryDto, "name">(FIELD_LIMITS.category.name, "Name"))}
            />
            <FieldError error={errors.name} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-prefix">Asset prefix code</Label>
              <Input
                id="cat-prefix"
                className="data-mono"
                placeholder="LT"
                {...limitInputProps(FIELD_LIMITS.category.assetPrefixCode)}
                {...register("assetPrefixCode", limitRules<CategoryDto, "assetPrefixCode">(FIELD_LIMITS.category.assetPrefixCode, "Prefix code"))}
              />
              <FieldError error={errors.assetPrefixCode} />
              <p className="text-xs text-muted-fg">New assets without a tag get the next one, e.g. LT-0001.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-warranty">Default warranty (months)</Label>
              <Input
                id="cat-warranty"
                type="number"
                {...limitInputProps(FIELD_LIMITS.category.defaultWarrantyPeriodMonths)}
                {...register(
                  "defaultWarrantyPeriodMonths",
                  limitRules<CategoryDto, "defaultWarrantyPeriodMonths">(FIELD_LIMITS.category.defaultWarrantyPeriodMonths, "Default warranty"),
                )}
              />
              <FieldError error={errors.defaultWarrantyPeriodMonths} />
              <p className="text-xs text-muted-fg">Sets a new asset&apos;s warranty expiry from its purchase date when none is given.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">Parent category</Label>
            <Select id="cat-parent" {...register("parentCategoryId")}>
              <option value="">None</option>
              {/* Not itself or a sub-category: that would make a cycle. */}
              {rows.filter((c) => parentOptions.has(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <FieldError error={errors.parentCategoryId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-policy">Depreciation policy</Label>
            <Select id="cat-policy" {...register("depreciationPolicyId")}>
              <option value="">None</option>
              {editing?.depreciationPolicyId && !policyById.has(editing.depreciationPolicyId) ? (
                <option value={editing.depreciationPolicyId}>Current policy</option>
              ) : null}
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({depreciationMethodLabel(p.method)}, {usefulLifeLabel(p.usefulLifeMonths)})
                </option>
              ))}
            </Select>
            <FieldError error={errors.depreciationPolicyId} />
            <p className="text-xs text-muted-fg">
              Assets in this category without their own useful life, method or residual value use this policy.{" "}
              <Link href="/depreciation-policies" className="ea-focus rounded-sm font-semibold text-brand hover:underline">
                Manage policies
              </Link>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea id="cat-description" {...register("description")} />
            <FieldError error={errors.description} />
          </div>
          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
