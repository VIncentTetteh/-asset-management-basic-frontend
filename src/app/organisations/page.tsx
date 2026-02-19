"use client";

import { useState, useEffect } from "react";
import { Organisation, OrganisationDto } from "@/types";
import { organisationService } from "@/services/organisationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function OrganisationsPage() {
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OrganisationDto>();

    const fetchOrganisations = async () => {
        try {
            setIsLoading(true);
            const data = await organisationService.getAll();
            setOrganisations(data);
        } catch (error) {
            toast.error("Failed to load organisations");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganisations();
    }, []);

    const handleOpenCreate = () => {
        setEditingOrg(null);
        reset({ name: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (org: Organisation) => {
        setEditingOrg(org);
        reset({ name: org.name });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this organisation?")) return;
        try {
            await organisationService.delete(id);
            toast.success("Organisation deleted");
            fetchOrganisations();
        } catch (error) {
            toast.error("Failed to delete organisation");
            console.error(error);
        }
    };

    const onSubmit = async (data: OrganisationDto) => {
        const isDuplicate = organisations.some(
            org => org.name.toLowerCase() === data.name.toLowerCase() && org.id !== editingOrg?.id
        );

        if (isDuplicate) {
            toast.error(`Organisation "${data.name}" already exists.`);
            return;
        }

        try {
            if (editingOrg) {
                await organisationService.update(editingOrg.id, data);
                toast.success("Organisation updated");
            } else {
                await organisationService.create(data);
                toast.success("Organisation created");
            }
            setIsModalOpen(false);
            fetchOrganisations();
        } catch (error) {
            toast.error("Failed to save organisation");
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organisations</h1>
                    <p className="text-slate-500">Manage your organizational structures here.</p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Organisation
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <p>Loading...</p>
                ) : organisations.length === 0 ? (
                    <p className="text-slate-500 col-span-full text-center py-10">No organisations found. Create one to get started.</p>
                ) : (
                    organisations.map((org) => (
                        <Card key={org.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {org.name}
                                </CardTitle>
                                <Building2 className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(org)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(org.id)}>
                                        <Trash2 className="h-4 w-4" />
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
                title={editingOrg ? "Edit Organisation" : "Create Organisation"}
                description={editingOrg ? "Update the details of the organisation." : "Add a new organisation to the system."}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Acme Corp"
                            {...register("name", { required: "Name is required" })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            {editingOrg ? "Save Changes" : "Create Organisation"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
