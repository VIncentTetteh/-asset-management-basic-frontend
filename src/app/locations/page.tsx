"use client";

import { useState, useEffect } from "react";
import { Location, LocationDto } from "@/types";
import { locationService } from "@/services/locationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageSpinner } from "@/components/ui/spinner";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, MapPin, Building2, Layers, Navigation, AlertCircle, LocateFixed, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { buildPatchPayload } from "@/lib/patch";
import { useConfirm } from "@/hooks/useConfirm";


export default function LocationsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [geoDetecting, setGeoDetecting] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<LocationDto>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const locData = await locationService.getAll();
            setLocations(locData);
        } catch (error) {
            toast.error("Failed to load data");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const detectLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        setGeoDetecting(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const { latitude, longitude } = coords;
                setValue("latitude", parseFloat(latitude.toFixed(6)));
                setValue("longitude", parseFloat(longitude.toFixed(6)));
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                        { headers: { "Accept-Language": "en" } }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data.address?.city || data.address?.town || data.address?.village) {
                            setValue("city", data.address.city || data.address.town || data.address.village);
                        }
                        if (data.address?.country) {
                            setValue("country", data.address.country);
                        }
                        if (data.display_name) {
                            setValue("address", data.display_name);
                        }
                    }
                } catch {
                    // Reverse geocode failed — coordinates are still set
                }
                setGeoDetecting(false);
                toast.success("Location detected");
            },
            (err) => {
                setGeoDetecting(false);
                toast.error(err.code === 1 ? "Location access denied" : "Could not detect location");
            },
            { timeout: 10000 }
        );
    };

    const handleOpenCreate = () => {
        setEditingLocation(null);
        reset({ name: "", building: "", floor: "", room: "", city: "", country: "", address: "", latitude: null, longitude: null, parentLocationId: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (location: Location) => {
        setEditingLocation(location);
        reset({
            name: location.name,
            building: location.building || "",
            floor: location.floor || "",
            room: location.room || "",
            city: location.city || "",
            country: location.country || "",
            address: location.address || "",
            latitude: location.latitude ?? null,
            longitude: location.longitude ?? null,
            parentLocationId: location.parentLocationId || "",
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ message: "Are you sure you want to delete this location?", variant: "danger" })) return;
        setDeletingId(id);
        try {
            await locationService.delete(id);
            toast.success("Location deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete location");
            console.error(error);
        } finally {
            setDeletingId(null);
        }
    };

    const onSubmit = async (data: LocationDto) => {
        const isDuplicate = locations.some(
            loc => loc.name.toLowerCase() === data.name.toLowerCase() && loc.id !== editingLocation?.id
        );

        if (isDuplicate) {
            toast.error(`Location "${data.name}" already exists.`);
            return;
        }

        // Clean empty optional fields
        if (!data.parentLocationId) delete data.parentLocationId;
        if (!data.building) delete data.building;
        if (!data.floor) delete data.floor;
        if (!data.room) delete data.room;
        if (!data.city) delete data.city;
        if (!data.country) delete data.country;
        if (!data.address) delete data.address;
        if (data.latitude == null || isNaN(Number(data.latitude))) delete data.latitude;
        if (data.longitude == null || isNaN(Number(data.longitude))) delete data.longitude;
        delete data.geoCoordinates; // managed server-side from lat/lng

        try {
            if (editingLocation) {
                const patch = buildPatchPayload<LocationDto>(editingLocation as unknown as Partial<LocationDto>, data);
                if (Object.keys(patch).length === 0) {
                    toast("No changes to update");
                    return;
                }
                await locationService.update(editingLocation.id!, patch);
                toast.success("Location updated");
            } else {
                await locationService.create(data);
                toast.success("Location created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to save location");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Locations</h1>
                    <p className="text-slate-500">Manage physical asset locations and spaces.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-rose-600 hover:bg-rose-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Location
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <PageSpinner />
                    </div>
                ) : locations.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center">
                        <MapPin className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No locations found</h3>
                        <p className="text-slate-500 mt-1 max-w-sm">Setup physical locations (buildings, rooms) to track where assets are stored.</p>
                        <Button onClick={handleOpenCreate} className="mt-6 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300">
                            Add Location
                        </Button>
                    </div>
                ) : (
                    locations.map((location) => (
                        <Card key={location.id} className="overflow-hidden hover:shadow-md transition-all flex flex-col h-full border-slate-200">
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-base font-semibold text-slate-900 truncate" title={location.name}>
                                        {location.name}
                                    </CardTitle>
                                    {(location.city || location.country) && (
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                                            {[location.city, location.country].filter(Boolean).join(", ")}
                                        </p>
                                    )}
                                </div>
                                {location.parentLocationId && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full border bg-slate-100 text-slate-600 border-slate-200 shrink-0 uppercase">
                                        Sub
                                    </span>
                                )}
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col">
                                <div className="p-4 space-y-4 flex-1">
                                    {/* Building Details */}
                                    {(location.building || location.floor || location.room) ? (
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Building2 className="h-3.5 w-3.5" /> Physical Space
                                            </h4>
                                            <div className="space-y-1.5 text-sm text-slate-700">
                                                {location.building && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 text-xs">Building</span>
                                                        <span className="font-medium">{location.building}</span>
                                                    </div>
                                                )}
                                                {location.floor && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 text-xs">Floor</span>
                                                        <span className="font-medium">{location.floor}</span>
                                                    </div>
                                                )}
                                                {location.room && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 text-xs">Room</span>
                                                        <span className="font-medium">{location.room}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No physical space details.</p>
                                    )}

                                    {/* Address */}
                                    {location.address && (
                                        <div className="pt-2 border-t border-slate-100">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                                <MapPin className="h-3.5 w-3.5" /> Address
                                            </h4>
                                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2" title={location.address}>
                                                {location.address}
                                            </p>
                                        </div>
                                    )}

                                    {/* Geo Coordinates */}
                                    {(location.latitude != null && location.longitude != null) && (
                                        <div className="pt-2 border-t border-slate-100">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                                <Navigation className="h-3.5 w-3.5" /> Coordinates
                                            </h4>
                                            <p className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 truncate">
                                                {location.latitude}, {location.longitude}
                                            </p>
                                        </div>
                                    )}

                                    {/* Hierarchy */}
                                    {location.parentLocationId && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 bg-rose-50 border border-rose-100 rounded-md px-2.5 py-1.5">
                                            <Layers className="h-4 w-4 text-rose-400 shrink-0" />
                                            <span className="text-xs font-medium text-rose-700">Nested sub-location</span>
                                        </div>
                                    )}

                                    {/* Empty Fallback */}
                                    {!location.building && !location.floor && !location.room && !location.address && location.latitude == null && !location.parentLocationId && (
                                        <div className="flex flex-col items-center justify-center opacity-50 py-2">
                                            <AlertCircle className="h-5 w-5 text-slate-300 mb-1" />
                                            <span className="text-[10px] text-slate-400 font-medium">BASIC RECORD</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-slate-50/50 mt-auto border-t border-slate-100 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(location)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(location.id!)} isLoading={deletingId === location.id} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingLocation ? "Edit Location" : "Create Location"}
                description={editingLocation ? "Update the location details." : "Add a new geographic or physical location."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                        <Label htmlFor="name">Location Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            placeholder="e.g. Main Warehouse"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="pt-2 border-t">
                        <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-3">Physical Space</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="building">Building</Label>
                                <Input id="building" placeholder="Block A" {...register("building")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="floor">Floor</Label>
                                <Input id="floor" placeholder="2nd Floor" {...register("floor")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="room">Room</Label>
                                <Input id="room" placeholder="Room 202" {...register("room")} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t">
                        <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-3">Location</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" placeholder="Accra" {...register("city")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="country">Country</Label>
                                <Input id="country" placeholder="Ghana" {...register("country")} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Coordinates</p>
                            <Button type="button" variant="outline" size="sm" onClick={detectLocation} disabled={geoDetecting} className="gap-1.5 h-7 text-xs">
                                {geoDetecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                                {geoDetecting ? "Detecting…" : "Detect GPS"}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    placeholder="5.657220"
                                    {...register("latitude", { valueAsNumber: true })}
                                    className="font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    placeholder="-0.246748"
                                    {...register("longitude", { valueAsNumber: true })}
                                    className="font-mono text-sm"
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">Click "Detect GPS" to auto-fill from your device and reverse-geocode city, country &amp; address.</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="address">Address <span className="text-slate-400 font-normal">(optional)</span></Label>
                        <Input id="address" placeholder="123 Main St, Accra, Ghana" {...register("address")} />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                        <Label htmlFor="parentLocationId">Parent Location</Label>
                        <Select id="parentLocationId" {...register("parentLocationId")}>
                            <option value="">None (top-level)</option>
                            {locations.filter(l => l.id !== editingLocation?.id).map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting} className="bg-rose-600 hover:bg-rose-700">
                            {editingLocation ? "Save Changes" : "Create Location"}
                        </Button>
                    </div>
                </form>
        {ConfirmDialog}
            </Modal>
        </div>
    );
}
