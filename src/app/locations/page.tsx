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
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";

const locations = makeCrudHooks<Location, LocationDto>("locations", locationService, { entity: "Location" });

export default function LocationsPage() {
  const { data: rows = [], isLoading } = locations.useList();
  const save = locations.useSave();
  const remove = locations.useDelete();
  const { confirm, ConfirmDialog } = useConfirm();

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LocationDto>();

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
            country: editing.country || "",
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
    const payload: LocationDto = { ...data };
    (Object.keys(payload) as (keyof LocationDto)[]).forEach((k) => {
      if (payload[k] === "") delete (payload as unknown as Record<string, unknown>)[k];
    });

    if (editing) {
      const patch = buildPatchPayload<LocationDto>(editing as unknown as Partial<LocationDto>, payload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to update");
        return;
      }
      await save.mutateAsync({ id: editing.id, data: patch as LocationDto });
    } else {
      await save.mutateAsync({ data: payload });
    }
    setIsModalOpen(false);
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
        cell: ({ row }) => <span className="text-muted-fg">{row.original.country || "—"}</span>,
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
        cell: ({ row }) => (
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
    [parentName],
  );

  return (
    <ListPageTemplate
      title="Locations"
      subtitle={isLoading ? "Loading locations…" : `${rows.length} sites and rooms`}
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New location
        </Button>
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
          <Button size="sm" onClick={openCreate}>
            <MapPin className="mr-1.5 h-4 w-4" /> New location
          </Button>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? "Edit location" : "New location"}
        description="Locations can nest — e.g. a floor under a building under a city."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor="loc-name">Name <span className="text-danger">*</span></Label>
            <Input id="loc-name" placeholder="Head Office, Accra" {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-sm text-danger">{errors.name.message as string}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loc-building">Building</Label>
              <Input id="loc-building" {...register("building")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-floor">Floor</Label>
              <Input id="loc-floor" {...register("floor")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-room">Room</Label>
              <Input id="loc-room" {...register("room")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loc-city">City</Label>
              <Input id="loc-city" {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-country">Country</Label>
              <Input id="loc-country" {...register("country")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" {...register("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-parent">Parent location</Label>
            <Select id="loc-parent" {...register("parentLocationId")}>
              <option value="">None</option>
              {rows.filter((l) => l.id !== editing?.id).map((l) => (
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
