"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, MapPin, Search } from "lucide-react";
import type { Location, LocationDto } from "@/types";
import { locationService } from "@/services/locationService";
import { makeCrudHooks } from "@/features/shared/crudHooks";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { DataTable, type ColumnDef } from "@/components/patterns/DataTable";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { countryName, toCountryCode } from "@/lib/countries";
import { buildPatchPayload } from "@/lib/patch";
import { applyApiFieldErrors, reportFormErrors } from "@/lib/api-validation";
import { FieldError } from "@/components/ui/field-error";
import { FIELD_LIMITS, limitInputProps, limitRules } from "@/lib/field-limits";
import { usePermissions } from "@/contexts/PermissionContext";
import { allowedParents, buildLocationPayload } from "@/features/locations/payload";
import { useConfirm } from "@/hooks/useConfirm";
import { ImportButton } from "@/features/imports/ImportButton";

// Edits go through PUT (full replace) so cleared fields and parents are cleared.
const L = FIELD_LIMITS.location;

const locations = makeCrudHooks<Location, LocationDto>(
  "locations",
  { ...locationService, update: (id, data) => locationService.replace(id, data as LocationDto) },
  { entity: "Location" },
);

export default function LocationsPage() {
  const { data: rows = [], isLoading } = locations.useList();
  const save = locations.useSave();
  const remove = locations.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<LocationDto>();
  const { hasPermission } = usePermissions();
  // Mirrors the API: location writes take MANAGE_LOCATIONS or MANAGE_ORGANIZATION_SETTINGS.
  const canManage = hasPermission("MANAGE_LOCATIONS") || hasPermission("MANAGE_ORGANIZATION_SETTINGS");
  const parentOptions = useMemo(() => allowedParents(rows, editing?.id ?? undefined), [rows, editing]);

  useEffect(() => {
    if (!isModalOpen) return;
    reset(
      editing
        ? {
            name: editing.name,
            building: editing.building || "",
            floor: editing.floor || "",
            room: editing.room || "",
            city: editing.city || "",
            country: toCountryCode(editing.country),
            address: editing.address || "",
            parentLocationId: editing.parentLocationId || "",
          }
        : { name: "", building: "", floor: "", room: "", city: "", country: "", address: "", parentLocationId: "" },
    );
  }, [isModalOpen, editing, reset]);

  const parentName = useMemo(() => {
    const map = new Map(rows.map((l) => [l.id, l.name]));
    return (id?: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.city || "").toLowerCase().includes(q) || (l.building || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (loc: Location) => {
    if (!(await confirm({ message: `Delete "${loc.name}"?`, variant: "danger" }))) return;
    remove.mutate(loc.id!);
  };

  const onSubmit = async (data: LocationDto) => {
    const payload = buildLocationPayload(data, editing);
    try {
      if (editing) {
        const before = buildLocationPayload(editing as unknown as LocationDto, editing);
        if (Object.keys(buildPatchPayload<LocationDto>(before, payload)).length === 0) {
          toast("No changes to update");
          return;
        }
        await save.mutateAsync({ id: editing.id, data: payload });
      } else {
        await save.mutateAsync({ data: payload });
      }
      setIsModalOpen(false);
    } catch (err) {
      // Toasted by the save hook; keep the form open with fields marked.
      applyApiFieldErrors(err, setError);
    }
  };

  const columns = useMemo<ColumnDef<Location, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Location",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-semibold text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-faint-fg">
              {[row.original.building, row.original.floor, row.original.room].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => <span className="text-muted-fg">{row.original.city || "—"}</span>,
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) => <span className="text-muted-fg">{countryName(row.original.country) || "—"}</span>,
      },
      {
        id: "parent",
        header: "Parent",
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-fg">{parentName(row.original.parentLocationId)}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => !canManage ? null : (
          <div className="flex justify-end gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit location"
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
              aria-label="Delete location"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentName, canManage],
  );

  return (
    <ListPageTemplate
      title="Locations"
      subtitle={isLoading ? "Loading locations…" : `${rows.length} sites and rooms`}
      actions={
        canManage ? (
          <>
            <ImportButton type="locations" />
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New location
            </Button>
          </>
        ) : undefined
      }
      toolbar={
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint-fg" />
          <Input placeholder="Search name, city, or building…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle="No locations yet"
        emptyDescription="Track sites, buildings, and rooms — nest them to mirror your physical footprint."
        emptyAction={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <MapPin className="mr-1.5 h-4 w-4" /> New location
            </Button>
          ) : undefined
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit location" : "New location"}
        description="Locations can nest — e.g. a floor under a building under a city."
      >
        <form onSubmit={handleSubmit(onSubmit, reportFormErrors)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="loc-name">Name <span className="text-danger">*</span></Label>
            <Input id="loc-name" placeholder="Head Office, Accra" {...limitInputProps(L.name)}
              {...register("name", limitRules<LocationDto, "name">(L.name, "Name"))} />
            <FieldError error={errors.name} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loc-building">Building</Label>
              <Input id="loc-building" {...limitInputProps(L.building)}
                {...register("building", limitRules<LocationDto, "building">(L.building, "Building"))} />
              <FieldError error={errors.building} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-floor">Floor</Label>
              <Input id="loc-floor" {...limitInputProps(L.floor)}
                {...register("floor", limitRules<LocationDto, "floor">(L.floor, "Floor"))} />
              <FieldError error={errors.floor} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-room">Room</Label>
              <Input id="loc-room" {...limitInputProps(L.room)}
                {...register("room", limitRules<LocationDto, "room">(L.room, "Room"))} />
              <FieldError error={errors.room} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loc-city">City</Label>
              <Input id="loc-city" {...limitInputProps(L.city)}
                {...register("city", limitRules<LocationDto, "city">(L.city, "City"))} />
              <FieldError error={errors.city} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-country">Country</Label>
              <CountrySelect
                id="loc-country"
                placeholder="No country"
                allowEmpty
                legacyValue={editing ? toCountryCode(editing.country) : undefined}
                {...register("country")}
              />
              <FieldError error={errors.country} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" {...register("address")} />
            <FieldError error={errors.address} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-parent">Parent location</Label>
            <Select id="loc-parent" {...register("parentLocationId")}>
              <option value="">None</option>
              {/* Not itself or a descendant: that would make a cycle. */}
              {rows.filter((l) => parentOptions.has(l.id!)).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={save.isPending}>
              {editing ? "Save changes" : "Create location"}
            </Button>
          </div>
        </form>
      </Modal>
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
