/**
 * Ids that may be picked as the parent of `selfId` in a self-referencing tree
 * (locations, categories): every node except itself and its descendants, which
 * would make a cycle. The API refuses those too.
 */
export function allowedTreeParents<T extends { id?: string | null }>(
    all: readonly T[],
    selfId: string | undefined,
    parentOf: (node: T) => string | null | undefined,
): Set<string> {
    const allowed = new Set(all.map((n) => n.id).filter((id): id is string => Boolean(id)));
    if (!selfId) return allowed;
    const children = new Map<string, string[]>();
    for (const n of all) {
        const parent = parentOf(n);
        if (!parent || !n.id) continue;
        children.set(parent, [...(children.get(parent) ?? []), n.id]);
    }
    const stack = [selfId];
    const seen = new Set<string>();
    while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue; // tolerate a stored cycle
        seen.add(id);
        allowed.delete(id);
        stack.push(...(children.get(id) ?? []));
    }
    return allowed;
}
