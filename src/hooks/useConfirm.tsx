import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import React from "react";
import { createPortal } from "react-dom";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
}

interface ConfirmState {
    isOpen: boolean;
    options: ConfirmOptions;
    ownerId: symbol | null;
    resolver: ((value: boolean) => void) | null;
}

const defaultOptions: ConfirmOptions = { message: "" };

let confirmState: ConfirmState = {
    isOpen: false,
    options: defaultOptions,
    ownerId: null,
    resolver: null,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return confirmState;
}

function emitChange() {
    listeners.forEach((listener) => listener());
}

function updateConfirmState(nextState: ConfirmState) {
    confirmState = nextState;
    emitChange();
}

function resolveActiveConfirm(value: boolean) {
    const resolver = confirmState.resolver;
    updateConfirmState({
        ...confirmState,
        isOpen: false,
        ownerId: null,
        resolver: null,
        options: defaultOptions,
    });
    resolver?.(value);
}

export function ConfirmDialogHost() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    if (typeof document === "undefined") return null;

    return createPortal(
        <ConfirmModal
            isOpen={state.isOpen}
            onConfirm={() => resolveActiveConfirm(true)}
            onCancel={() => resolveActiveConfirm(false)}
            title={state.options.title}
            message={state.options.message}
            confirmLabel={state.options.confirmLabel}
            cancelLabel={state.options.cancelLabel}
            variant={state.options.variant}
        />,
        document.body
    );
}

export function useConfirm() {
    const ownerIdRef = useRef(Symbol("confirm-owner"));

    const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
        const resolvedOpts = typeof opts === "string" ? { message: opts } : opts;

        return new Promise((resolve) => {
            if (confirmState.resolver) {
                confirmState.resolver(false);
            }

            updateConfirmState({
                isOpen: true,
                options: resolvedOpts,
                ownerId: ownerIdRef.current,
                resolver: resolve,
            });
        });
    }, []);

    useEffect(() => {
        const ownerId = ownerIdRef.current;

        return () => {
            if (confirmState.ownerId === ownerId) {
                resolveActiveConfirm(false);
            }
        };
    }, []);

    // ConfirmDialog stays a no-op so existing page-level placements remain harmless.
    return { confirm, ConfirmDialog: null as unknown as React.ReactElement };
}
