"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldValues, type Path, type PathValue, type DefaultValues } from "react-hook-form";
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
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { usePermissions } from "@/contexts/PermissionContext";
import { buildCompliancePayload, buildComplianceReplacePayload } from "@/features/compliance/payload";
import { useConfirm } from "@/hooks/useConfirm";
import { FieldError } from "@/components/ui/field-error";
import { fieldLimit, limitInputProps, limitRules, type FieldLimit, type LimitedEntity } from "@/lib/field-limits";
import { AttachmentField, attachAfterCreate, useAttachmentField } from "@/components/ui/attachment-field";
import type { AttachmentEntityType } from "@/types";

/** One form control, rendered in a two-column grid (span2 for full width). */
export interface FieldSpec<TDto> {
  name: keyof TDto & string;
  label: string;
  /**
   * "attachment" turns the field into the document uploader: the column still
   * holds whatever URL was stored before uploads existed (shown as a link), and
   * `attachmentEntityType` says what the file is attached to. At most one per page.
   */
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "attachment";
  /** Required for `type: "attachment"`. */
  attachmentEntityType?: AttachmentEntityType;
  options?: { value: string; label: string }[];
  required?: boolean;
  mono?: boolean;
  placeholder?: string;
  span2?: boolean;
  step?: string;
  min?: number;
  max?: number;
  /** Fixed once created (the API ignores it on edit): shown disabled and sent unchanged. */
  lockedOnEdit?: boolean;
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
    /** Full replace (PUT): fields sent as null are cleared. */
    update: (id: string, data: Partial<TDto>) => Promise<T>;
    /** Absent for registers the API cannot delete; pass canDelete={false} with it. */
    delete?: (id: string) => Promise<void>;
  };
  /** False for registers the API cannot delete (PCI SAQ answers). */
  canDelete?: boolean;
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
  /** Backend limits for this entity (see lib/field-limits.ts): lengths, ranges, required. */
  limits?: LimitedEntity;
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
  limits,
  canDelete = true,
}: ComplianceCrudPageProps<T, TDto>) {
  const { hasPermission } = usePermissions();
  // Mirrors the API: every compliance write takes MANAGE_COMPLIANCE or MANAGE_SECURITY_SETTINGS.
  const canManage = hasPermission("MANAGE_COMPLIANCE") || hasPermission("MANAGE_SECURITY_SETTINGS");
  const entityPlural = entity.endsWith("y")
    ? `${entity.slice(0, -1)}ies`
    : `${entity}s`;
  const dynamicOptions = useOptions?.() ?? {};
  const hooks = useMemo(
    () =>
      makeCrudHooks<T, TDto>(
        moduleKey,
        {
          ...service,
          delete: service.delete ?? (async () => {
            throw new Error(`${entity} records cannot be deleted`);
          }),
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
  const { data: rows = [], isLoading, error, refetch, isFetching } = hooks.useList();
  const save = hooks.useSave();
  const remove = hooks.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors } } = useForm<TDto>();

  // Evidence/report/policy documents are uploaded, not linked. A new record holds
  // the file until the create returns its id (see attachAfterCreate in onSubmit).
  const attachmentSpec = fields.find((f) => f.type === "attachment");
  const attachments = useAttachmentField({
    entityType: attachmentSpec?.attachmentEntityType ?? "COMPLIANCE_CONTROL",
    entityId: editing?.id ?? null,
  });

  useEffect(() => {
    if (isModalOpen) {
      attachments.reset();
      reset(toFormDefaults(editing));
    }
    // `attachments.reset` only clears local picker state; it is stable per modal open.
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
    const transformed = (toPayload ? toPayload(data) : data) as Record<string, unknown>;

    try {
      if (editing) {
        // Edits are a full replace (PUT): a cleared date, number, select or owner is
        // sent as null and cleared. Fields fixed at create keep the record's value.
        const record = editing as unknown as Record<string, unknown>;
        const fixed = Object.fromEntries(
          fields.filter((f) => f.lockedOnEdit).map((f) => [f.name, record[f.name]]),
        );
        const payload = buildComplianceReplacePayload(fields, transformed, fixed);
        const before = toFormDefaults(editing) as unknown as TDto;
        const previous = buildComplianceReplacePayload(
          fields, (toPayload ? toPayload(before) : before) as Record<string, unknown>, fixed);
        if (Object.keys(buildPatchPayload(previous, payload)).length === 0) {
          toast("No changes to update");
          return;
        }
        await save.mutateAsync({ id: editing.id!, data: payload as TDto });
      } else {
        const payload = buildCompliancePayload(fields, transformed) as TDto;
        const saved = await save.mutateAsync({ data: payload });
        // The record exists now, so the held file finally has something to hang
        // off. A failure here says so; it never passes for a clean save.
        if (attachmentSpec) await attachAfterCreate(attachments, saved?.id, entity.toLowerCase());
      }
      setIsModalOpen(false);
    } catch (err) {
      // The save hook toasted; keep the form open with the fields marked.
      applyApiFieldErrors(err, setError);
    }
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
        cell: ({ row }: { row: { original: T } }) => !canManage ? null : (
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
            {canDelete && service.delete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-danger"
                aria-label={`Delete ${entity.toLowerCase()}`}
                onClick={() => handleDelete(row.original)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, entity, canManage, canDelete],
  );

  return (
    <ListPageTemplate
      title={title}
      subtitle={isLoading ? `Loading ${entityPlural.toLowerCase()}…` : error ? "Couldn't load right now" : `${rows.length} records`}
      actions={
        canManage ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New {entity}
          </Button>
        ) : undefined
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
        error={error}
        onRetry={refetch}
        isRetrying={isFetching}
        errorWhat={`your ${entityPlural.toLowerCase()}`}
        emptyTitle={`No ${entityPlural.toLowerCase()} yet`}
        emptyDescription={emptyDescription}
        emptyAction={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Icon className="mr-1.5 h-4 w-4" /> New {entity}
            </Button>
          ) : undefined
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? `Edit ${entity}` : `New ${entity}`}
        description={description}
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => {
              const id = `cc-${field.name}`;
              const common = { id, placeholder: field.placeholder };
              const err = errors[field.name as Path<TDto>];
              // Backend limits win; the field spec fills in what the backend leaves open.
              const backend = limits ? fieldLimit(limits, field.name) : {};
              const limit: FieldLimit = {
                ...backend,
                required: field.required ?? backend.required,
                min: backend.min ?? field.min,
                max: backend.max ?? field.max,
                step: backend.step ?? (field.step as FieldLimit["step"]),
              };
              const rules = limitRules<TDto>(limit, field.label);
              return (
                <div key={field.name} className={`space-y-2 ${field.span2 || field.type === "textarea" || field.type === "attachment" ? "col-span-2" : ""}`}>
                  {field.type !== "checkbox" && field.type !== "attachment" && (
                    <Label htmlFor={id}>
                      {field.label} {limit.required && <span className="text-danger">*</span>}
                    </Label>
                  )}
                  {field.type === "attachment" ? (
                    <>
                      {/* The stored URL is carried through untouched so a legacy link is never cleared. */}
                      {attachments.enabled ? <input type="hidden" {...register(field.name as Path<TDto>)} /> : null}
                      <AttachmentField
                        state={attachments}
                        label={field.label}
                        // From form state, not `editing`: a cleared link must stay
                        // cleared on the next render rather than re-appearing.
                        legacyUrl={String(watch(field.name as Path<TDto>) ?? "") || null}
                        onClearLegacy={() =>
                          setValue(field.name as Path<TDto>, "" as PathValue<TDto, Path<TDto>>, { shouldDirty: true })
                        }
                        fallback={
                          <>
                            <Label htmlFor={id}>{field.label}</Label>
                            <Input
                              {...common}
                              type="text"
                              maxLength={limit.maxLength}
                              {...register(field.name as Path<TDto>, rules)}
                            />
                          </>
                        }
                      />
                    </>
                  ) : field.type === "select" ? (
                    <Select
                      {...common}
                      disabled={!!editing && field.lockedOnEdit}
                      title={editing && field.lockedOnEdit ? `${field.label} cannot change after the record is created` : undefined}
                      {...register(field.name as Path<TDto>, editing && field.lockedOnEdit ? {} : rules)}
                    >
                      {!limit.required && <option value="">—</option>}
                      {(field.options ?? dynamicOptions[field.name] ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      {...common}
                      maxLength={limit.maxLength}
                      {...register(field.name as Path<TDto>, rules)}
                    />
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
                      {...(field.type === "number" ? limitInputProps({ ...limit, maxLength: undefined }) : { maxLength: limit.maxLength })}
                      className={field.mono ? "data-mono" : undefined}
                      {...register(field.name as Path<TDto>, rules)}
                    />
                  )}
                  <FieldError error={err} fallback={`${field.label} is required`} />
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
