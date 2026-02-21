"use client";

import { useState, useEffect } from "react";
import { Location } from "@/types";
import { locationService } from "@/services/locationService";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";

export default function LocationsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>();

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [locData, orgData] = await Promise.all([
                locationService.getAll(),
                organisationService.getAll()
            ]);
            setLocations(locData);
            setOrganisations(orgData);
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

    const handleOpenCreate = () => {
        setEditingLocation(null);
        reset({ name: "", address: "", city: "", state: "", country: "", zipCode: "", parentLocationId: "", organisationId: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (location: Location) => {
        setEditingLocation(location);
        reset({
            name: location.name,
            address: location.address || "",
            city: location.city || "",
            state: location.state || "",
            country: location.country || "",
            zipCode: location.zipCode || "",
            parentLocationId: location.parentLocationId || "",
            organisationId: location.organisationId || ""
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this location?")) return;
        try {
            await locationService.delete(id);
            toast.success("Location deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete location");
            console.error(error);
        }
    };

    const onSubmit = async (data: any) => {
        const isDuplicate = locations.some(
            loc => loc.name.toLowerCase() === data.name.toLowerCase() && loc.id !== editingLocation?.id
        );

        if (isDuplicate) {
            toast.error(`Location "${data.name}" already exists.`);
            return;
        }

        try {
            // Clean empty relationships
            if (!data.parentLocationId) delete data.parentLocationId;
            if (!data.organisationId) delete data.organisationId;

            if (editingLocation) {
                await locationService.update(editingLocation.id!, data);
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
                    <p className="text-slate-500">Manage physical asset locations.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-rose-600 hover:bg-rose-700">
                    <Plus className="mr-2 h-4 w-4" /> Add Location
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
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
                        <Card key={location.id} className="overflow-hidden hover:shadow-md transition-all group border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-900 truncate" title={location.name}>
                                    {location.name}
                                </CardTitle>
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                                    <MapPin className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col justify-between" style={{ minHeight: '140px' }}>
                                <div>
                                    <p className="text-sm text-slate-700 mb-1">{location.address || "No address"}</p>
                                    <p className="text-xs text-slate-500 mb-2">
                                        {[location.city, location.state, location.country].filter(Boolean).join(", ")}
                                    </p>
                                    {location.parentLocationId && (
                                        <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                            Sub-location
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(location)} className="h-8">
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(location.id!)} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-3.5 w-3.5" />
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
                            placeholder="e.g. Headquarters, Room 402"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" placeholder="123 Corporate Blvd" {...register("address")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" placeholder="San Francisco" {...register("city")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">State/Region</Label>
                            <Input id="state" placeholder="CA" {...register("state")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="zipCode">Zip/Postal Code</Label>
                            <Input id="zipCode" placeholder="94105" {...register("zipCode")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input id="country" placeholder="USA" {...register("country")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="parentLocationId">Parent Location</Label>
                            <Select id="parentLocationId" {...register("parentLocationId")}>
                                <option value="">None</option>
                                {locations.filter(l => l.id !== editingLocation?.id).map((loc) => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="organisationId">Linked Organisation</Label>
                            <Select id="organisationId" {...register("organisationId")}>
                                <option value="">None</option>
                                {organisations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </Select>
                        </div>
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
            </Modal>
        </div>
    );
}
