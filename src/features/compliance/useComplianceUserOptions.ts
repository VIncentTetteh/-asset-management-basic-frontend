"use client";

import { useQuery } from "@tanstack/react-query";
import { userService } from "@/services/userService";
import { qk } from "@/lib/queryClient";
import type { User } from "@/types";

type Option = { value: string; label: string };

/** "Ama Mensah (ama@x.com)"; the API only accepts users of the signed-in tenant. */
export function userOptions(users: User[]): { byId: Option[]; byEmail: Option[] } {
    const active = users.filter((u) => u.id && u.status !== "INACTIVE");
    const label = (u: User) => `${u.firstName} ${u.lastName} (${u.email})`;
    return {
        byId: active.map((u) => ({ value: u.id as string, label: label(u) })),
        byEmail: active.map((u) => ({ value: u.email, label: label(u) })),
    };
}

/**
 * Owner / assignee pickers for the compliance registers: ownerId, reportedById
 * and assignedToId take a user id; approvedByEmail takes the user's email.
 */
export function useComplianceUserOptions(): Partial<Record<string, Option[]>> {
    const { data: users = [] } = useQuery({
        queryKey: qk.module("users").list(),
        queryFn: () => userService.getAll(),
        staleTime: 300_000,
    });
    const { byId, byEmail } = userOptions(users);
    return { ownerId: byId, reportedById: byId, assignedToId: byId, approvedByEmail: byEmail };
}
