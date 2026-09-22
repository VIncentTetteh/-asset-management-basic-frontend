export type TransferAction = "approve" | "reject" | "complete" | "delete";

/**
 * Row actions per transfer status. Mirrors AssetTransferServiceImpl, which
 * answers 409 for anything else:
 *
 *   REQUESTED -approve-> APPROVED -complete-> COMPLETED
 *   REQUESTED/APPROVED -reject-> REJECTED
 *   anything but COMPLETED can be deleted (a completed move is the audit trail)
 *
 * The requester never sees Approve on their own request (maker-checker; the API
 * refuses it too). Every action needs TRANSFER_ASSET (admins hold every
 * permission), so a viewer without it sees none.
 */
export function transferActionsFor(
  transfer: { status?: string; requestedById?: string },
  currentUserId?: string,
  canManage = true,
): TransferAction[] {
  if (!canManage) return [];
  const isRequester = !!currentUserId && transfer.requestedById === currentUserId;
  switch (transfer.status ?? "REQUESTED") {
    case "REQUESTED":
      return isRequester ? ["reject", "delete"] : ["approve", "reject", "delete"];
    case "APPROVED":
      return ["complete", "reject", "delete"];
    case "COMPLETED":
      return [];
    default:
      return ["delete"];
  }
}

export const TRANSFER_ACTION_MESSAGES: Record<TransferAction, string> = {
  approve: "Transfer approved",
  reject: "Transfer rejected",
  complete: "Transfer completed — asset moved",
  delete: "Transfer deleted",
};

/** The body of POST /transfers. The origin is not sent: the API reads it from the asset. */
export interface TransferRequestBody {
  assetId: string;
  toDepartmentId: string;
  toLocationId?: string;
  reason?: string;
}

/**
 * Builds a transfer request, or the reason it cannot be made. Mirrors the API:
 * the destination department must differ from the asset's current one (an asset
 * with no department may go anywhere); the destination location may equal the
 * current one (moving department only).
 */
export function buildTransferRequest(
  form: { assetId?: string; toDepartmentId?: string; toLocationId?: string; reason?: string },
  asset: { departmentId?: string | null } | undefined,
): { body: TransferRequestBody } | { error: string } {
  if (!form.assetId) return { error: "Asset is required" };
  if (!form.toDepartmentId) return { error: "Destination department required" };
  if (asset?.departmentId && asset.departmentId === form.toDepartmentId) {
    return { error: "Destination department must be different from the asset's current department" };
  }
  return {
    body: {
      assetId: form.assetId,
      toDepartmentId: form.toDepartmentId,
      toLocationId: form.toLocationId || undefined,
      reason: form.reason?.trim() || undefined,
    },
  };
}
