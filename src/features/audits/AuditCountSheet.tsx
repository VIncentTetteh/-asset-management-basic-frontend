"use client";

import { useState } from "react";
import { ScanLine, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AuditSeal } from "@/components/ui/audit-seal";
import { Modal } from "@/components/ui/modal";
import { AuditDiscrepancyType, AuditItemStatus, type Audit, type AuditItem } from "@/types";
import {
  useAuditItems,
  useFlagAuditItemDiscrepancy,
  useGenerateAuditItems,
  useVerifyAuditItem,
} from "@/features/audits/hooks";
import {
  auditProgressLabel,
  auditProgressOf,
  canCountItems,
  DISCREPANCY_TYPES,
} from "@/features/audits/workflow";

const PAGE_SIZE = 20;

/**
 * An audit's count sheet: what is in scope, what has been sighted, and what is
 * wrong.
 *
 * <p>The scan box takes whatever came off the label — a QR link, the legacy
 * `asset:<uuid>` text, a bare id, or a tag typed by hand — and hands it to the
 * server, which parses it with the same AssetQrCodes the mobile scanner uses.
 * One box therefore serves the scanner and the keyboard, and the client never
 * has to know the label format.
 */
export function AuditCountSheet({ audit }: { audit: Audit }) {
  const auditId = audit.id!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [scan, setScan] = useState("");
  const [flagging, setFlagging] = useState<AuditItem | null>(null);

  const open = canCountItems(audit.status);
  const progress = auditProgressOf(audit);
  const { data, isLoading } = useAuditItems(auditId, {
    search: search || undefined,
    status: status || undefined,
    page,
    size: PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const generate = useGenerateAuditItems();
  const verify = useVerifyAuditItem();

  const submitScan = () => {
    const value = scan.trim();
    if (!value) return;
    verify.mutate({ auditId, body: { scan: value } }, { onSettled: () => setScan("") });
  };

  return (
    <div className="space-y-4" data-testid="audit-count-sheet">
      {/* ── Progress ────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {/* The seal is shown only when every item is verified — that is the
                whole point of the count sheet existing. */}
            <AuditSeal
              verified={progress.allVerified}
              title={progress.allVerified ? "Every asset on this audit was verified" : "Not every asset has been verified"}
            />
            <span data-testid="audit-progress-label">{auditProgressLabel(progress)}</span>
          </p>
          <span className="data-mono text-xs text-muted-fg">{progress.percent}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
          role="progressbar"
          aria-label="Audit verification progress"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-ok transition-[width]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {progress.total === 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-surface-subtle p-3">
            <p className="text-sm text-muted-fg">
              This audit has nothing to count yet. Build the sheet from the assets in its scope.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!open || generate.isPending}
              isLoading={generate.isPending}
              onClick={() => generate.mutate(auditId)}
              data-testid="audit-generate-items"
            >
              <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Build count sheet
            </Button>
          </div>
        ) : null}
      </section>

      {/* ── Scan / search ───────────────────────────────────────────────────── */}
      {open ? (
        <section className="space-y-2">
          <Label htmlFor="audit-scan">Scan or type an asset tag</Label>
          <div className="flex gap-2">
            <Input
              id="audit-scan"
              className="data-mono"
              placeholder="Scan the QR label, or type the asset tag"
              value={scan}
              autoComplete="off"
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // A barcode wedge types the value and presses Enter; the form
                  // around this panel must not submit on that.
                  event.preventDefault();
                  submitScan();
                }
              }}
              data-testid="audit-scan-input"
            />
            <Button
              type="button"
              onClick={submitScan}
              disabled={!scan.trim() || verify.isPending}
              isLoading={verify.isPending}
              data-testid="audit-verify-scan"
            >
              <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Verify
            </Button>
          </div>
          <p className="text-xs text-faint-fg">
            A scanned link, an <span className="data-mono">asset:</span> code, an asset id or a tag all work.
          </p>
        </section>
      ) : (
        <p className="rounded-md bg-surface-subtle p-3 text-sm text-muted-fg">
          This audit is closed — its count sheet is a final record and cannot change.
        </p>
      )}

      {/* ── The sheet ───────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="audit-item-search" className="text-xs">Find an asset</Label>
            <Input
              id="audit-item-search"
              className="h-8 text-xs"
              placeholder="Asset tag or name"
              value={search}
              onChange={(event) => {
                setPage(0);
                setSearch(event.target.value);
              }}
              data-testid="audit-item-search"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-item-status" className="text-xs">Status</Label>
            <Select
              id="audit-item-status"
              className="h-8 w-40 text-xs"
              value={status}
              onChange={(event) => {
                setPage(0);
                setStatus(event.target.value);
              }}
            >
              <option value="">All</option>
              <option value={AuditItemStatus.PENDING}>Pending</option>
              <option value={AuditItemStatus.VERIFIED}>Verified</option>
              <option value={AuditItemStatus.DISCREPANCY}>Discrepancy</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-fg">Loading the count sheet…</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-sm text-muted-fg" data-testid="audit-items-empty">
            {progress.total === 0 ? "No items on this sheet yet." : "Nothing matches those filters."}
          </p>
        ) : (
          <ul className="divide-y divide-edge-subtle" data-testid="audit-items">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2" data-testid="audit-item-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    <span className="data-mono">{item.assetTag || "—"}</span>{" "}
                    <span className="font-normal text-muted-fg">{item.assetName}</span>
                  </p>
                  <p className="text-xs text-faint-fg">
                    {item.expectedLocation ? `Expected: ${item.expectedLocation}` : "No expected location"}
                    {item.actualLocation ? ` · Found: ${item.actualLocation}` : ""}
                  </p>
                  {item.discrepancyReason ? (
                    <p className="text-xs text-warn">
                      {String(item.discrepancyType ?? "").replace(/_/g, " ").toLowerCase()}: {item.discrepancyReason}
                    </p>
                  ) : null}
                  {item.verifiedByName ? (
                    <p className="text-xs text-faint-fg">Recorded by {item.verifiedByName}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={String(item.status)} />
                  {open ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-ok"
                        disabled={verify.isPending}
                        onClick={() =>
                          verify.mutate({ auditId, body: { scan: item.assetId } })
                        }
                        aria-label={`Verify ${item.assetTag || item.assetName || "asset"}`}
                      >
                        Verify
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-warn"
                        onClick={() => setFlagging(item)}
                        aria-label={`Flag ${item.assetTag || item.assetName || "asset"}`}
                      >
                        Flag
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between pt-1 text-xs text-muted-fg">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
            </span>
            <span className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        ) : null}
      </section>

      <DiscrepancyModal item={flagging} auditId={auditId} onClose={() => setFlagging(null)} />
    </div>
  );
}

/** Records what is wrong with one item: a type and a reason, both required. */
function DiscrepancyModal({
  item,
  auditId,
  onClose,
}: {
  item: AuditItem | null;
  auditId: string;
  onClose: () => void;
}) {
  const [discrepancyType, setDiscrepancyType] = useState<string>(AuditDiscrepancyType.MISSING);
  const [reason, setReason] = useState("");
  const [actualLocation, setActualLocation] = useState("");
  const flag = useFlagAuditItemDiscrepancy();

  const close = () => {
    setReason("");
    setActualLocation("");
    setDiscrepancyType(AuditDiscrepancyType.MISSING);
    onClose();
  };

  return (
    <Modal
      isOpen={!!item}
      onClose={close}
      title={item ? `Discrepancy · ${item.assetTag || item.assetName || "asset"}` : "Discrepancy"}
      description="Say what is wrong and why. A flag with no reason tells the next auditor nothing."
    >
      <div className="space-y-4" data-testid="audit-discrepancy-form">
        <div className="space-y-2">
          <Label htmlFor="audit-discrepancy-type">Type <span className="text-danger">*</span></Label>
          <Select
            id="audit-discrepancy-type"
            value={discrepancyType}
            onChange={(event) => setDiscrepancyType(event.target.value)}
          >
            {DISCREPANCY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-discrepancy-location">Where it was actually found</Label>
          <Input
            id="audit-discrepancy-location"
            maxLength={255}
            value={actualLocation}
            onChange={(event) => setActualLocation(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-discrepancy-reason">Reason <span className="text-danger">*</span></Label>
          <Textarea
            id="audit-discrepancy-reason"
            maxLength={5000}
            placeholder="Not at the desk it is booked to; asked the team, nobody has seen it this quarter."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          <Button
            type="button"
            disabled={!reason.trim() || flag.isPending}
            isLoading={flag.isPending}
            data-testid="audit-discrepancy-save"
            onClick={() => {
              if (!item) return;
              flag.mutate(
                {
                  auditId,
                  itemId: item.id!,
                  body: {
                    discrepancyType,
                    reason: reason.trim(),
                    actualLocation: actualLocation.trim() || null,
                  },
                },
                { onSuccess: close },
              );
            }}
          >
            Record discrepancy
          </Button>
        </div>
      </div>
    </Modal>
  );
}
