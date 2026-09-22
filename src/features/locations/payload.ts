import type { Location, LocationDto } from "@/types";
import { optionalString } from "@/features/finance/payloads";

/**
 * Full body for POST and PUT /locations. Edits are PUTs (the old PATCH diff
 * dropped blanks, so a floor, room or parent could never be removed); fields
 * the form does not edit — coordinates — are carried from the record.
 */
export function buildLocationPayload(form: LocationDto, existing?: Location | null): LocationDto {
  return {
    name: form.name.trim(),
    building: optionalString(form.building) ?? undefined,
    floor: optionalString(form.floor) ?? undefined,
    room: optionalString(form.room) ?? undefined,
    city: optionalString(form.city) ?? undefined,
    country: optionalString(form.country) ?? undefined,
    address: optionalString(form.address) ?? undefined,
    parentLocationId: optionalString(form.parentLocationId),
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
    geoCoordinates: existing?.geoCoordinates ?? undefined,
  };
}

/** Locations that may be picked as the parent of `self`: not itself or any of its descendants. */
export function allowedParents(all: Pick<Location, "id" | "parentLocationId">[], selfId?: string): Set<string> {
  const allowed = new Set(all.map((l) => l.id!));
  if (!selfId) return allowed;
  const children = new Map<string, string[]>();
  for (const l of all) {
    if (!l.parentLocationId) continue;
    children.set(l.parentLocationId, [...(children.get(l.parentLocationId) ?? []), l.id!]);
  }
  const stack = [selfId];
  while (stack.length) {
    const id = stack.pop()!;
    allowed.delete(id);
    stack.push(...(children.get(id) ?? []));
  }
  return allowed;
}
