"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
    className?: string;
    size?: "xs" | "sm" | "default" | "lg";
    color?: string;
}

const sizeMap = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-10 w-10",
};

export function Spinner({ className, size = "default", color }: SpinnerProps) {
    return (
        <Loader2
            className={cn(
                "animate-spin",
                sizeMap[size],
                color ?? "text-teal-600",
                className
            )}
        />
    );
}

export function PageSpinner({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Spinner size="lg" className="text-teal-600" />
            {label && <p className="text-sm text-slate-500 animate-pulse">{label}</p>}
        </div>
    );
}

export function InlineSpinner({ className }: { className?: string }) {
    return <Spinner size="sm" className={cn("inline-block", className)} />;
}
