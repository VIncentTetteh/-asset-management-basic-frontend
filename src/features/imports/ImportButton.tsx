"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ImportWizardModal } from "@/features/imports/ImportWizardModal";

/**
 * The single entry point to the importer, for any module.
 *
 * A page adds `<ImportButton type="suppliers" />` next to its New button and
 * gets the whole wizard — template, upload, mapping, checks, job progress —
 * with nothing module-specific to write.
 */
export function ImportButton({
    type,
    label = "Import",
    variant = "outline",
    size,
    className,
    onImported,
}: {
    type: string;
    label?: string;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
    onImported?: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                className={className}
                onClick={() => setIsOpen(true)}
                data-testid={`import-open-${type}`}
            >
                <FileSpreadsheet aria-hidden="true" className="mr-2 h-4 w-4" />
                {label}
            </Button>
            <ImportWizardModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                type={type}
                onImported={onImported}
            />
        </>
    );
}
