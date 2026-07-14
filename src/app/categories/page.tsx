"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";

const categories = makeCrudHooks<Category, CategoryDto>("categories", categoryService, { entity: "Category" });

export default function CategoriesPage() {
  const { data: rows = [], isLoading } = categories.useList();
  const save = categories.useSave();
  const remove = categories.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryDto>();

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            description: editing.description || "",
            assetPrefixCode: editing.assetPrefixCode || "",
            parentCategoryId: editing.parentCategoryId || "",
            defaultWarrantyPeriodMonths: editing.defaultWarrantyPeriodMonths,
          }
        : { name: "", description: "", assetPrefixCode: "", parentCategoryId: "", defaultWarrantyPeriodMonths: undefined },
    );
  }, [isModalOpen, editing, reset]);

  const parentName = useMemo(() => {
    const map = new Map(rows.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [rows]);

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
    const payload: CategoryDto = { ...data };
    if (payload.defaultWarrantyPeriodMonths != null && String(payload.defaultWarrantyPeriodMonths) !== "") {
      payload.defaultWarrantyPeriodMonths = Number(payload.defaultWarrantyPeriodMonths);
    } else {
      delete payload.defaultWarrantyPeriodMonths;
    }
    (Object.keys(payload) as (keyof CategoryDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as unknown as Record<string, unknown>)[k];
    });

    if (editing) {
      const patch = buildPatchPayload<CategoryDto>(editing as unknown as Partial<CategoryDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id, data: patch as CategoryDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
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
    [parentName],
  );

  return (
    <ListPageTemplate
      title="Categories"
      subtitle={isLoading ? "Loading categories…" : `${rows.length} asset categories`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New category
        </Button>
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
        emptyTitle="No categories yet"
        emptyDescription="Organise assets into categories with prefix codes and default warranty periods."
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name <span className="text-danger">*</span></Label>
            <Input id="cat-name" placeholder="Laptops" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-prefix">Asset prefix code</Label>
              <Input id="cat-prefix" className="data-mono" placeholder="LT" {...register("assetPrefixCode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-warranty">Default warranty (months)</Label>
              <Input id="cat-warranty" type="number" min="0" {...register("defaultWarrantyPeriodMonths")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">Parent category</Label>
            <Select id="cat-parent" {...register("parentCategoryId")}>
              <option value="">None</option>
              {rows.filter((c) => c.id !== editing?.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea id="cat-description" {...register("description")} />
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
