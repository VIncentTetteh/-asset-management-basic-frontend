import * as React from "react";
import { AlertTriangle, Trash2, Info } from "lucide-react";
import { Button } from "./button";

interface ConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
}

export function ConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const iconMap = {
        danger: <Trash2 className="h-6 w-6 text-danger" />,
        warning: <AlertTriangle className="h-6 w-6 text-warn" />,
        info: <Info className="h-6 w-6 text-info" />,
    };

    const confirmButtonClass = {
        danger: "bg-danger hover:opacity-90 text-white",
        warning: "bg-warn hover:opacity-90 text-white",
        info: "bg-info hover:opacity-90 text-white",
    };

    const iconBgClass = {
        danger: "bg-danger-soft",
        warning: "bg-warn-soft",
        info: "bg-info-soft",
    };

    const defaultTitle = {
        danger: "Confirm Deletion",
        warning: "Confirm Action",
        info: "Confirm",
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface text-foreground border border-edge rounded-panel shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className={`w-12 h-12 rounded-full ${iconBgClass[variant]} flex items-center justify-center mx-auto mb-4`}>
                        {iconMap[variant]}
                    </div>
                    <h3 className="text-base font-bold text-foreground text-center mb-2">
                        {title || defaultTitle[variant]}
                    </h3>
                    <p className="text-sm text-muted-fg text-center leading-relaxed">
                        {message}
                    </p>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        className={`flex-1 ${confirmButtonClass[variant]}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
