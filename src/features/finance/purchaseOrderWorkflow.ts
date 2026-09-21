import { POStatus } from "@/types";

export type PoWorkflowAction = "submit" | "approve" | "reject" | "receive" | "cancel" | "delete";

/**
 * Row actions offered per purchase-order status. Mirrors the backend state
 * machine (PurchaseOrderServiceImpl), which rejects anything else with 409:
 *
 *   DRAFT -submit-> SUBMITTED -approve-> APPROVED -receive-> DELIVERED
 *   SUBMITTED -reject-> REJECTED; DRAFT/SUBMITTED/APPROVED -cancel-> CANCELLED
 */
const ACTIONS: Record<string, PoWorkflowAction[]> = {
    [POStatus.DRAFT]: ["submit", "cancel", "delete"],
    [POStatus.SUBMITTED]: ["approve", "reject", "cancel", "delete"],
    [POStatus.APPROVED]: ["receive", "cancel", "delete"],
    [POStatus.DELIVERED]: ["delete"],
    [POStatus.REJECTED]: ["delete"],
    [POStatus.CANCELLED]: ["delete"],
};

export const poActionsFor = (status: string | undefined): PoWorkflowAction[] =>
    ACTIONS[status ?? POStatus.DRAFT] ?? ["delete"];

export const PO_ACTION_MESSAGES: Record<PoWorkflowAction, string> = {
    submit: "Purchase order submitted for approval",
    approve: "Purchase order approved — amount committed against its budget",
    reject: "Purchase order rejected",
    receive: "Purchase order marked as received",
    cancel: "Purchase order cancelled",
    delete: "Purchase order deleted",
};
