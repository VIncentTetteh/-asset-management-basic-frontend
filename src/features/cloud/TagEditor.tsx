"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagRow } from "@/features/cloud/options";

/** Key/value editor for a cloud asset's tags (saved as a JSON object). */
export function TagEditor({ rows, onChange, error }: { rows: TagRow[]; onChange: (rows: TagRow[]) => void; error?: string | null }) {
  const update = (index: number, patch: Partial<TagRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="text-xs text-faint-fg">No tags.</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`Tag ${index + 1} name`}
            placeholder="team"
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
            className="h-8 text-xs"
          />
          <Input
            aria-label={`Tag ${index + 1} value`}
            placeholder="payments"
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
            className="h-8 text-xs"
          />
          <button
            type="button"
            aria-label={`Remove tag ${index + 1}`}
            className="ea-focus rounded-sm p-1 text-muted-fg hover:text-danger"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus className="mr-1 h-3 w-3" /> Add tag
      </Button>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
