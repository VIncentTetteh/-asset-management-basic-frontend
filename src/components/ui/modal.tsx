import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    /** "wide" is for multi-column content such as the import wizard's mapping step. */
    size?: "default" | "wide";
    children: React.ReactNode;
}

const SIZES: Record<NonNullable<ModalProps["size"]>, string> = {
    default: "max-w-lg",
    wide: "max-w-3xl",
};

export function Modal({ isOpen, onClose, title, description, size = "default", children }: ModalProps) {
    if (!isOpen || typeof document === "undefined") return null;

    // Portaled to <body> — page wrappers use a `page-enter` mount animation
    // (globals.css) whose `forwards` fill-mode leaves a permanent, harmless
    // -looking `transform: translateY(0)` on the page root after it plays.
    // Any non-`none` transform on an ancestor becomes the containing block
    // for `position: fixed` descendants (CSS spec behaviour), which broke
    // this modal's viewport-relative centering whenever it was rendered
    // inline inside a migrated page. Portaling escapes that — and any other
    // ancestor transform/overflow/z-index issue — for good.
    return createPortal(
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center overflow-y-auto p-4 animate-in fade-in duration-200">
            <div className={`flex max-h-[85vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-panel border border-edge bg-surface text-foreground shadow-lg animate-in zoom-in-95 duration-200`}>
                {/* min-w-0 + gap: without them a long description ran under the
                    close button at phone width, which was visible on the role
                    permissions modal at 400px. */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-edge-subtle px-6 py-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-foreground">{title}</h3>
                        {description && (
                            <p className="mt-1 text-sm text-muted-fg">{description}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" className="-mt-1 shrink-0" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
                <div className="overflow-y-auto p-6">{children}</div>
            </div>
        </div>,
        document.body
    );
}
