"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldValues, type Path, type DefaultValues } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Search, type LucideIcon } from "lucide-react";
import { makeCrudHooks } from "@/features/shared/crudHooks";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";

/** One form control, rendered in a two-column grid (span2 for full width). */
export interface FieldSpec<TDto> {
  name: keyof TDto & string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  mono?: boolean;
  placeholder?: string;
  span2?: boolean;
  step?: string;
  min?: number;
  max?: number;
}

export interface ColumnSpec<T> {
  header: string;
  /** primary = bold main line (+ optional subKey line); status uses StatusBadge. */
  kind: "primary" | "text" | "mono" | "date" | "status" | "number" | "bool";
  key: keyof T & string;
  subKey?: keyof T & string;
  /** Right-align (numbers). */
  right?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface ComplianceCrudPageProps<T extends { id?: string }, TDto extends FieldValues> {
  title: string;
  entity: string;
  icon: LucideIcon;
  description: string;
  service: {
    getAll: () => Promise<T[] | { items?: T[]; content?: T[] }>;
    create: (data: TDto) => Promise<T>;
    update: (id: string, data: Partial<TDto>) => Promise<T>;
    delete: (id: string) => Promise<void>;
  };
  moduleKey: string;
  columns: ColumnSpec<T>[];
  fields: FieldSpec<TDto>[];
  /** Map an existing row into form defaults (edit); omit fields for create defaults. */
  toFormDefaults: (editing: T | null) => DefaultValues<TDto>;
  /** Optional payload transform before create/update (e.g. Number() coercions). */
  toPayload?: (data: TDto) => TDto;
  searchKeys: (keyof T & string)[];
  emptyDescription: string;
  /** Hook returning dynamic select options keyed by field name (e.g. asset lists). */
  useOptions?: () => Partial<Record<string, { value: string; label: string }[]>>;
}

function cellFor<T extends { id?: string }>(spec: ColumnSpec<T>, row: T): React.ReactNode {
  if (spec.render) return spec.render(row);
  const value = row[spec.key] as unknown;
  switch (spec.kind) {
    case "primary": {
      const sub = spec.subKey ? (row[spec.subKey] as unknown) : undefined;
      return (
        <div className="min-w-0 max-w-64">
          <p className="truncate font-semibold text-foreground">{String(value ?? "—")}</p>
          {sub != null && sub !== "" ? <p className="truncate text-xs text-faint-fg">{String(sub)}</p> : null}
        </div>
      );
    }
    case "mono":
      return value != null && value !== "" ? (
        <span className="data-mono text-xs">{String(value)}</span>
      ) : (
        <span className="text-faint-fg">—</span>
      );
    case "date":
      return (
        <span className="text-muted-fg">{value ? new Date(String(value)).toLocaleDateString() : "—"}</span>
      );
    case "status":
      return <StatusBadge status={String(value ?? "—")} />;
    case "number":
      return <span className="data-mono block text-right">{value != null ? String(value) : "—"}</span>;
    case "bool":
      return <span className="text-muted-fg">{value ? "Yes" : "No"}</span>;
    default:
      return <span className="text-muted-fg">{value != null && value !== "" ? String(value) : "—"}</span>;
  }
}

export function ComplianceCrudPage<T extends { id?: string }, TDto extends FieldValues>({
  title,
  entity,
  icon: Icon,
  description,
  service,
  moduleKey,
  columns,
  fields,
  toFormDefaults,
  toPayload,
  searchKeys,
  emptyDescription,
  useOptions,
}: ComplianceCrudPageProps<T, TDto>) {
  const dynamicOptions = useOptions?.() ?? {};
  const hooks = useMemo(
    () =>
      makeCrudHooks<T, TDto>(
        moduleKey,
        {
          ...service,
          // Some endpoints return a pagination envelope; normalize to a list.
          getAll: async () => {
            const result = await service.getAll();
            if (Array.isArray(result)) return result;
            return result.items ?? result.content ?? [];
          },
        },
        { entity },
      ),
    // Service/module identity is static per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleKey],
  );
  const { data: rows = [], isLoading } = hooks.useList();
  const save = hooks.useSave();
  const remove = hooks.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TDto>();

  useEffect(() => {
    if (isModalOpen) reset(toFormDefaults(editing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, editing, reset]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search, searchKeys]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (row: T) => {
    if (!(await confirm({ message: `Delete this ${entity.toLowerCase()}?`, variant: "danger" }))) return;
    remove.mutate(row.id!);
  };

  const onSubmit = async (data: TDto) => {
    let payload = toPayload ? toPayload(data) : data;
    payload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== ""),
    ) as TDto;

    if (editing) {
      const patch = buildPatchPayload<TDto>(editing as unknown as Partial<TDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id!, data: patch as TDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
  };

  const tableColumns = useMemo<ColumnDef<T, unknown>[]>(
    () => [
      ...columns.map((spec) => ({
        id: spec.key,
        header: spec.right ? () => <span className="block text-right">{spec.header}</span> : spec.header,
        enableSorting: false,
        cell: ({ row }: { row: { original: T } }) => cellFor(spec, row.original),
      })),
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }: { row: { original: T } }) => (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Edit ${entity.toLowerCase()}`}
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
              aria-label={`Delete ${entity.toLowerCase()}`}
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, entity],
  );

  return (
    <ListPageTemplate
      title={title}
      subtitle={isLoading ? `Loading ${entity.toLowerCase()}s…` : `${rows.length} records`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New {entity.toLowerCase()}
        </Button>
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      }
    >
      <DataTable
        columns={tableColumns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle={`No ${entity.toLowerCase()}s yet`}
        emptyDescription={emptyDescription}
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Icon className="mr-1.5 h-4 w-4" /> New {entity.toLowerCase()}
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? `Edit ${entity.toLowerCase()}` : `New ${entity.toLowerCase()}`}
        description={description}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => {
              const id = `cc-${field.name}`;
              const common = { id, placeholder: field.placeholder };
              const err = errors[field.name as Path<TDto>];
              return (
                <div key={field.name} className={`space-y-2 ${field.span2 || field.type === "textarea" ? "col-span-2" : ""}`}>
                  {field.type !== "checkbox" && (
                    <Label htmlFor={id}>
                      {field.label} {field.required && <span className="text-danger">*</span>}
                    </Label>
                  )}
                  {field.type === "select" ? (
                    <Select {...common} {...register(field.name as Path<TDto>, { required: field.required })}>
                      {!field.required && <option value="">—</option>}
                      {(field.options ?? dynamicOptions[field.name] ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea {...common} {...register(field.name as Path<TDto>, { required: field.required })} />
                  ) : field.type === "checkbox" ? (
                    <div className="flex h-9 items-center gap-2">
                      <input
                        type="checkbox"
                        id={id}
                        className="ea-focus rounded border-edge accent-[var(--primary)]"
                        {...register(field.name as Path<TDto>)}
                      />
                      <Label htmlFor={id} className="cursor-pointer">{field.label}</Label>
                    </div>
                  ) : (
                    <Input
                      {...common}
                      type={field.type}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      className={field.mono ? "data-mono" : undefined}
                      {...register(field.name as Path<TDto>, { required: field.required })}
                    />
                  )}
                  {err && <p className="text-sm text-danger">{field.label} is required</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : `Create ${entity.toLowerCase()}`}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}


/**
 * Builds form defaults: create defaults when nothing is being edited,
 * otherwise the edited row's values (dates trimmed to yyyy-MM-dd).
 */
export function defaultsFrom<T, TDto extends FieldValues>(
  editing: T | null,
  fields: FieldSpec<TDto>[],
  createDefaults: DefaultValues<TDto>,
): DefaultValues<TDto> {
  if (!editing) return createDefaults;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (editing as Record<string, unknown>)[field.name];
    if (value == null) {
      out[field.name] = (createDefaults as Record<string, unknown>)[field.name] ?? (field.type === "checkbox" ? false : "");
    } else if (field.type === "date") {
      out[field.name] = String(value).split("T")[0];
    } else {
      out[field.name] = value;
    }
  }
  return out as DefaultValues<TDto>;
}
