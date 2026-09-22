"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Asset, AssetHistory, Department, Organisation, Category, Location, User, Supplier, PurchaseOrder } from "@/types";
import { assetService } from "@/services/assetService";
import { normalizeAssetHistoryEntry } from "@/lib/assetHistory";
import { formatRelativeTime } from "@/lib/time";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
    History, QrCode, Info, Loader2, Download, Clock, User as UserIcon, Copy, Printer, Wallet
} from "lucide-react";
import { toast } from "react-hot-toast";
import { printAssetLabel } from "@/features/assets/printLabel";
import { AssetFinancials } from "@/features/assets/AssetFinancials";
import { formatLocalDate } from "@/lib/local-date";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    departments: Department[];
    locations: Location[];
    categories: Category[];
    users: User[];
    organisations?: Organisation[];
    suppliers?: Supplier[];
    purchaseOrders?: PurchaseOrder[];
}

type Tab = "overview" | "financials" | "history" | "qrcode";

const resolveQrPayload = (payload: Blob | Record<string, unknown> | string): string => {
    if (payload instanceof Blob) {
        return URL.createObjectURL(payload);
    }
    if (typeof payload === "string") {
        const trimmed = payload.trim().replace(/^"+|"+$/g, "");
        if (trimmed.startsWith("data:image") || /^https?:\/\//i.test(trimmed)) return trimmed;
        if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100) {
            return `data:image/png;base64,${trimmed.replace(/\s/g, "")}`;
        }
        return "";
    }

    const candidates = [payload.data, payload.qrCode, payload.image, payload.imageUrl, payload.content, payload.bytes, payload.payload, payload.base64];
    const first = candidates.find((value) => typeof value === "string" && value.trim());
    return first ? resolveQrPayload(String(first)) : "";
};

export function AssetDetailModal({
    isOpen, onClose, asset, departments, locations, categories, users, organisations = [], suppliers = [], purchaseOrders = [],
}: Props) {
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [history, setHistory] = useState<AssetHistory[]>([]);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
    // Keyed by asset so a stale link from the previously opened asset never shows.
    const [scanLink, setScanLink] = useState<{ assetId: string; url: string } | null>(null);
    const scanUrl = scanLink && scanLink.assetId === asset?.id ? scanLink.url : "";

    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const locMap = new Map(locations.map(l => [l.id, l.name]));
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
    const orgMap = new Map(organisations.map(o => [o.id, o.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
    const poMap = new Map(purchaseOrders.map(po => [po.id, po.poNumber]));
    /** A related record's name, or a neutral label when it is set but not in the loaded list. */
    const relationName = (map: Map<string | undefined, string | undefined>, id: string | undefined, none: string) =>
        id ? (map.get(id) || "Not in list") : none;

    useEffect(() => {
        if (!isOpen || !asset?.id) return;

        let cancelled = false;
        const assetId = asset.id;
        void assetService.getHistory(assetId)
            .then((data) => {
                if (!cancelled) setHistory(data.map(normalizeAssetHistoryEntry));
            })
            .catch((error: unknown) => console.error("Failed to load history", error));

        void assetService.getQrCode(assetId)
            .then((payload) => {
                if (!cancelled) setQrCodeUrl(resolveQrPayload(payload));
            })
            .catch((error: unknown) => console.error("Failed to load QR code", error));

        void assetService.getQrPayload(assetId)
            .then((payload) => {
                if (!cancelled && typeof payload.url === "string") setScanLink({ assetId, url: payload.url });
            })
            .catch((error: unknown) => console.error("Failed to load QR scan link", error));

        return () => {
            cancelled = true;
        };
    }, [isOpen, asset?.id]);

    useEffect(() => () => {
        if (qrCodeUrl.startsWith("blob:")) URL.revokeObjectURL(qrCodeUrl);
    }, [qrCodeUrl]);

    const handleClose = () => {
        setActiveTab("overview");
        onClose();
    };

    const getFriendlyAction = (h: AssetHistory) => {
        const type = (h.eventType || h.action || "").toUpperCase();
        const path = h.path || "";
        
        if (type === "API_ACTION" || !type) {
            if (path.includes("assign-user")) return "User Assigned";
            if (path.includes("assign-department")) return "Department Changed";
            if (path.includes("custom-fields")) return "Attribute Updated";
            if (path.includes("maintenance")) return "Maintenance Activity";
            if (path.includes("qrcode")) return "QR Code Generated";
            
            if (h.httpMethod === "POST") return "Asset Created";
            if (h.httpMethod === "PATCH" || h.httpMethod === "PUT") return "Asset Updated";
            if (h.httpMethod === "DELETE") return "Asset Deleted";
            
            return "System Action";
        }

        const labels: Record<string, string> = {
            "TRANSFER": "Location Transfer",
            "MAINTENANCE": "Maintenance Performed",
            "DISPOSAL": "Asset Disposal",
            "DEPRECATION": "Value Adjusted",
            "APPROVAL": "Request Approved"
        };

        return labels[type] || type.replace(/_/g, ' ') || "Asset Activity";
    };

    const getFriendlyNotes = (h: AssetHistory) => {
        const notes = h.notes || h.summary || h.description || "";
        // If it starts with a technical path or looks like an API call string, hide it
        if (notes.startsWith("/") || notes.includes("/api/v1/") || notes.includes(" → ")) {
            return "";
        }
        return notes;
    };

    if (!asset) return null;

    const tabs = [
        { id: "overview", label: "Overview", icon: Info },
        { id: "financials", label: "Financials", icon: Wallet },
        { id: "history", label: "History", icon: History },
        { id: "qrcode", label: "QR Code", icon: QrCode },
    ];

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleClose} 
            title={asset.name} 
            description={`Asset Tag: ${asset.assetTag || 'N/A'}`}
        >
            <div className="flex flex-col">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto pb-1 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === tab.id 
                                ? "border-indigo-600 text-indigo-600" 
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="max-h-[55vh] overflow-y-auto px-1">
                    {activeTab === "overview" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <DetailItem label="Status" value={asset.status ? asset.status.replace(/_/g, ' ') : "—"} highlight />
                                <DetailItem label="Condition" value={asset.condition} />
                                <DetailItem label="Category" value={catMap.get(asset.categoryId || "") || "Uncategorized"} />
                                <DetailItem label="Organisation" value={orgMap.get(asset.organisationId || "") || "—"} />
                                <DetailItem label="Department" value={deptMap.get(asset.departmentId || "") || "Not Assigned"} />
                                <DetailItem label="Location" value={locMap.get(asset.locationId || "") || "Not Assigned"} />
                                <DetailItem label="Assigned To" value={userMap.get(asset.assignedUserId || "") || "Unassigned"} />
                                <DetailItem label="Serial Number" value={asset.serialNumber || "N/A"} />
                                <DetailItem label="Manufacturer" value={asset.manufacturer || "N/A"} />
                                <DetailItem label="Model" value={asset.model || "N/A"} />
                                <DetailItem label="Purchase Date" value={formatLocalDate(asset.purchaseDate, { fallback: "N/A" })} />
                                <DetailItem label="Asset Type" value={asset.assetType ? String(asset.assetType).replace(/_/g, ' ') : "—"} />
                                <DetailItem label="Warranty Expiry" value={formatLocalDate(asset.warrantyExpiryDate, { fallback: "N/A" })} />
                                <DetailItem label="Supplier" value={relationName(supplierMap, asset.supplierId, "N/A")} />
                                <DetailItem label="Purchase Order" value={relationName(poMap, asset.purchaseOrderId, "N/A")} />
                                <DetailItem label="Procurement Type" value={asset.procurementType || "N/A"} />
                                <DetailItem label="Cost Centre" value={asset.costCenter || "N/A"} />
                                <DetailItem label="Invoice" value={asset.invoiceId || "N/A"} />
                                <DetailItem label="Insurance Policy" value={asset.insurancePolicyId || "N/A"} />
                            </div>
                            {asset.description && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                        &ldquo;{asset.description}&rdquo;
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "financials" && (
                        <AssetFinancials asset={asset} category={categories.find(c => c.id === asset.categoryId)} />
                    )}

                    {activeTab === "history" && (
                        <div className="space-y-3">
                            {history.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No activity history found.</p>
                                </div>
                            ) : (
                                history.map((h, i) => (
                                    <div key={h.id || i} className="relative pl-6 pb-6 border-l border-slate-200 last:pb-0">
                                        <div className="absolute left-[-5px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-200 border-2 border-white shadow-sm" />
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs font-bold text-indigo-600 tracking-tight">
                                                {getFriendlyAction(h)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {formatRelativeTime(h.createdAt || h.occurredAt)}
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all">
                                            {h.userName && (
                                                <p className="text-[10px] text-slate-500 mb-2 flex items-center gap-1.5 font-medium">
                                                    <span className="bg-slate-100 p-0.5 rounded-full"><UserIcon className="h-2.5 w-2.5" /></span>
                                                    {h.userName}
                                                </p>
                                            )}
                                            {(h.fieldName || h.summary) && (
                                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-50 mb-2">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{h.fieldName || h.summary}</p>
                                                    {(h.oldValue || h.newValue) && (
                                                        <p className="text-xs text-slate-700 font-medium">
                                                            <span className="line-through opacity-40 mr-2">&ldquo;{h.oldValue || 'none'}&rdquo;</span>
                                                            <span className="text-indigo-600">&ldquo;{h.newValue || 'updated'}&rdquo;</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {getFriendlyNotes(h) && <p className="text-xs text-slate-600 leading-relaxed italic">{getFriendlyNotes(h)}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "qrcode" && (
                        <div className="flex flex-col items-center justify-center space-y-6 py-8">
                            <div className="p-8 bg-white rounded-3xl shadow-xl border-8 border-slate-50 group hover:border-indigo-50 transition-all duration-500">
                                {qrCodeUrl ? (
                                    <Image src={qrCodeUrl} alt="Asset QR Code" width={192} height={192} unoptimized className="h-48 w-48" />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center bg-slate-50 animate-pulse rounded-lg">
                                        <Loader2 className="h-10 w-10 text-slate-200 animate-spin" />
                                    </div>
                                )}
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-bold text-slate-800 tracking-tight">System Identity QR Code</p>
                                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                                    Scan this code to instantly view asset maintenance history or update its status from a mobile device.
                                </p>
                            </div>
                            {scanUrl ? (
                                <div className="flex w-full max-w-sm items-center gap-2">
                                    <input
                                        readOnly
                                        aria-label="Scan link"
                                        value={scanUrl}
                                        onFocus={(e) => e.currentTarget.select()}
                                        className="min-w-0 flex-1 rounded-control border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        aria-label="Copy scan link"
                                        onClick={() => {
                                            void navigator.clipboard?.writeText(scanUrl)
                                                .then(() => toast.success("Scan link copied"))
                                                .catch(() => toast.error("Couldn't copy the link"));
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : null}
                            {qrCodeUrl && (
                                <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        void printAssetLabel({
                                            qrImageSrc: qrCodeUrl,
                                            assetTag: asset.assetTag,
                                            name: asset.name,
                                        }).then((opened) => {
                                            if (!opened) toast.error("Allow pop-ups to print the label");
                                        });
                                    }}
                                >
                                    <Printer className="h-4 w-4 mr-2" /> Print label
                                </Button>
                                <Button 
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = qrCodeUrl;
                                        link.download = `QR_${asset.assetTag || asset.id}.png`;
                                        link.click();
                                    }}
                                    variant="outline"
                                    className="border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                >
                                    <Download className="h-4 w-4 mr-2" /> Download Image
                                </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex shrink-0 justify-end pt-4 border-t mt-4 border-slate-200">
                    <Button variant="outline" onClick={handleClose} className="px-8 font-semibold tracking-wide border-slate-300 hover:bg-slate-50">
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function DetailItem({ label, value, highlight = false }: { label: string, value?: string, highlight?: boolean }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
            <p className={`text-sm font-semibold truncate ${highlight ? "text-indigo-600" : "text-slate-800"}`}>
                {value || "—"}
            </p>
        </div>
    );
}
