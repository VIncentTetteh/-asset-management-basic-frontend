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
 * refuses it too).
 */
export function transferActionsFor(
  transfer: { status?: string; requestedById?: string },
  currentUserId?: string,
): TransferAction[] {
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
