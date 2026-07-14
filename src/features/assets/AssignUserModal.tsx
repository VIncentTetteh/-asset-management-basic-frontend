"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import toast from "react-hot-toast";
import type { Asset, User } from "@/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AssetTag } from "@/components/ui/asset-tag";
import { useAssignAsset, useUnassignAsset } from "@/features/assets/hooks";

export function AssignUserModal({
  isOpen,
  onClose,
  asset,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  users: User[];
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const assign = useAssignAsset();
  const unassign = useUnassignAsset();

  useEffect(() => {
    if (isOpen) setAssigneeId(asset?.assignedUserId || "");
  }, [isOpen, asset]);

  const handleAssign = async () => {
    if (!asset?.id || !assigneeId) {
      toast.error("Select a user to assign");
      return;
    }
    await assign.mutateAsync({ assetId: asset.id, userId: assigneeId });
    onClose();
  };

  const handleUnassign = async () => {
    if (!asset?.id) return;
    await unassign.mutateAsync(asset.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign asset"
      description={asset ? `Choose who holds ${asset.name}.` : "Choose who holds this asset."}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-card border border-edge bg-surface-muted p-3 text-sm">
          <p className="font-semibold text-foreground">{asset?.name || "Selected asset"}</p>
          {asset?.assetTag ? <AssetTag tag={asset.assetTag} /> : <span className="text-faint-fg">No tag</span>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignee">Assign to user</Label>
          <Select id="assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          {asset?.assignedUserId && (
            <Button type="button" variant="ghost" onClick={handleUnassign} isLoading={unassign.isPending}>
              <UserMinus className="mr-1 h-4 w-4" />
              Unassign
            </Button>
          )}
          <Button type="button" onClick={handleAssign} isLoading={assign.isPending}>
            <UserPlus className="mr-1 h-4 w-4" />
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
