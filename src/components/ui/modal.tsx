import * as React from "react";
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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                        {description && (
                            <p className="text-sm text-slate-500 mt-1">{description}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
