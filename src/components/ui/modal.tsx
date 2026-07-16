import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
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
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-panel border border-edge bg-surface text-foreground shadow-lg animate-in zoom-in-95 duration-200">
                <div className="flex shrink-0 items-center justify-between border-b border-edge-subtle px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">{title}</h3>
                        {description && (
                            <p className="mt-1 text-sm text-muted-fg">{description}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="overflow-y-auto p-6">{children}</div>
            </div>
        </div>,
        document.body
    );
}
