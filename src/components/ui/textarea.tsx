import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "ea-focus min-h-[96px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
                    className
                )}
                {...props}
            />
        );
    }
);
Textarea.displayName = "Textarea";

export { Textarea };
