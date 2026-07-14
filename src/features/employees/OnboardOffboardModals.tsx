"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, PackagePlus, UserMinus } from "lucide-react";
import type { Asset } from "@/types";
import type { EmployeeDto, EmployeeChecklistItemDto } from "@/services/employeeService";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useOnboardEmployee, useOffboardEmployee } from "@/features/employees/hooks";

interface DraftItem {
  title: string;
  itemType: "GENERAL" | "ASSET_ISSUE";
  assetId?: string;
}

/**
 * Onboarding wizard: build the checklist. ASSET_ISSUE items pick an asset
 * that is checked out to the employee automatically when the item is
 * completed.
 */
export function OnboardModal({
  employee,
  onClose,
  assets,
}: {
  employee: EmployeeDto | null;
  onClose: () => void;
  assets: Asset[];
}) {
  const onboard = useOnboardEmployee();
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (employee) setItems([{ title: "Sign employment paperwork", itemType: "GENERAL" }]);
  }, [employee]);

  const availableAssets = assets.filter((a) => a.status === "IN_STOCK" || a.status === "RESERVED");

  const update = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const submit = async () => {
    if (!employee?.id) return;
    const payload: EmployeeChecklistItemDto[] = items
      .filter((it) => it.title.trim() || (it.itemType === "ASSET_ISSUE" && it.assetId))
      .map((it) => {
        if (it.itemType === "ASSET_ISSUE") {
          const asset = assets.find((a) => a.id === it.assetId);
          return {
            title: it.title.trim() || `Issue asset: ${asset?.name ?? ""}`,
            itemType: "ASSET_ISSUE" as const,
            assetId: it.assetId,
          };
        }
        return { title: it.title.trim(), itemType: "GENERAL" as const };
      });
    await onboard.mutateAsync({ id: employee.id, items: payload });
    onClose();
  };

  return (
    <Modal
      isOpen={employee !== null}
      onClose={onClose}
      title={employee ? `Onboard ${employee.firstName} ${employee.lastName}` : "Onboard"}
      description="Build the onboarding checklist. Completing an asset item checks that asset out to the employee."
    >
      <div className="space-y-4">
        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-card border border-edge bg-surface-muted p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={item.itemType}
                  onChange={(e) => update(i, { itemType: e.target.value as DraftItem["itemType"], assetId: undefined })}
                  className="w-36 shrink-0"
                >
                  <option value="GENERAL">Task</option>
                  <option value="ASSET_ISSUE">Issue asset</option>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8 text-danger"
                  aria-label="Remove item"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {item.itemType === "ASSET_ISSUE" ? (
                <div className="space-y-1.5">
                  <Label>Asset to issue</Label>
                  <Select value={item.assetId ?? ""} onChange={(e) => update(i, { assetId: e.target.value })}>
                    <option value="">Select asset (in stock)</option>
                    {availableAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.assetTag || "no tag"})</option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Task</Label>
                  <Input
                    value={item.title}
                    placeholder="e.g. Sign NDA, security briefing…"
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, { title: "", itemType: "GENERAL" }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add task
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((p) => [...p, { title: "", itemType: "ASSET_ISSUE" }])}
          >
            <PackagePlus className="mr-1 h-3.5 w-3.5" /> Add asset issue
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-edge-subtle pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={onboard.isPending} disabled={items.length === 0}>
            Start onboarding
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function OffboardModal({
  employee,
  onClose,
}: {
  employee: EmployeeDto | null;
  onClose: () => void;
}) {
  const offboard = useOffboardEmployee();
  const heldCount = employee?.activeAssetCount ?? 0;

  const submit = async () => {
    if (!employee?.id) return;
    await offboard.mutateAsync({ id: employee.id });
    onClose();
  };

  return (
    <Modal
      isOpen={employee !== null}
      onClose={onClose}
      title={employee ? `Offboard ${employee.firstName} ${employee.lastName}` : "Offboard"}
      description="Starts the exit process. The employee is terminated only after every held asset is returned."
    >
      <div className="space-y-4">
        <div className="rounded-card border border-edge bg-warn-soft p-4 text-sm text-foreground">
          {heldCount > 0 ? (
            <>
              This employee currently holds <span className="data-mono font-bold">{heldCount}</span>{" "}
              asset{heldCount === 1 ? "" : "s"}. A return item is created for each one — completing an
              item checks the asset back in.
            </>
          ) : (
            <>This employee holds no assets — offboarding will complete immediately and mark them terminated.</>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} isLoading={offboard.isPending}>
            <UserMinus className="mr-1.5 h-4 w-4" /> Start offboarding
          </Button>
        </div>
      </div>
    </Modal>
  );
}
