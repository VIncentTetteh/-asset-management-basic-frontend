"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import type { AssetTransfer } from "@/types";
import { ListPageTemplate } from "@/components/templates/ListPageTemplate";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useTransfers, useTransferMasterData, useTransferAction } from "@/features/transfers/hooks";
import { TransferTable } from "@/features/transfers/TransferTable";
import { TransferFormModal } from "@/features/transfers/TransferFormModal";

export default function TransfersPage() {
  const { data: transfers = [], isLoading } = useTransfers();
  const master = useTransferMasterData();
  const transferAction = useTransferAction();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const lookups = useMemo(() => {
    const assetMap = new Map(master.assets.map((a) => [a.id, a]));
    const deptMap = new Map(master.departments.map((d) => [d.id, d.name]));
    const locMap = new Map(master.locations.map((l) => [l.id, l.name]));
    return {
      assetName: (id?: string) => assetMap.get(id ?? "")?.name ?? "Unknown asset",
      assetTag: (id?: string) => assetMap.get(id ?? "")?.assetTag ?? undefined,
      deptName: (id?: string) => deptMap.get(id ?? "") ?? "—",
      locName: (id?: string) => locMap.get(id ?? "") ?? "—",
    };
  }, [master.assets, master.departments, master.locations]);

  const handleAction = async (transfer: AssetTransfer, action: "approve" | "reject" | "complete" | "delete") => {
    if (action === "delete") {
      if (!(await confirm({ message: "Delete this transfer request?", variant: "danger" }))) return;
    }
    transferAction.mutate({ id: transfer.id!, action });
  };

  const pending = transfers.filter((t) => t.status === "REQUESTED").length;

  return (
    <ListPageTemplate
      title="Transfers"
      subtitle={
        isLoading
          ? "Loading transfers…"
          : `${transfers.length} transfer${transfers.length === 1 ? "" : "s"} · ${pending} awaiting approval`
      }
      actions={
        <Button onClick={() => setIsModalOpen(true)}>
          <ArrowRightLeft className="mr-2 h-4 w-4" /> Request transfer
        </Button>
      }
    >
      <TransferTable
        transfers={transfers}
        isLoading={isLoading}
        lookups={lookups}
        onAction={handleAction}
        onCreate={() => setIsModalOpen(true)}
      />

      <TransferFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assets={master.assets}
        departments={master.departments}
        locations={master.locations}
      />
      {ConfirmDialog}
    </ListPageTemplate>
  );
}
