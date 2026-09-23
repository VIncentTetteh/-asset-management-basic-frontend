"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepHeading } from "@/features/imports/WizardChrome";

/**
 * The first screen. A first-time importer has exactly two situations — they
 * have nothing yet, or they already have a sheet from another system — and
 * this says which is which before asking for a file.
 */
export function ImportStartStep({
    plural,
    description,
    onDownloadTemplate,
    downloadingFormat,
    onContinue,
}: {
    plural: string;
    description?: string;
    onDownloadTemplate: (format: "xlsx" | "csv") => void;
    downloadingFormat: "xlsx" | "csv" | null;
    onContinue: () => void;
}) {
    return (
        <div className="space-y-5">
            <StepHeading hint={description || `Bring ${plural} into AssetIQ from a spreadsheet.`}>
                How would you like to start?
            </StepHeading>

            <div className="grid gap-3 sm:grid-cols-2">
                <section className="flex flex-col gap-3 rounded-card border border-edge bg-surface-muted p-4">
                    <div className="flex items-start gap-2">
                        <FileSpreadsheet aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                        <div>
                            <h5 className="text-sm font-bold text-foreground">Download our template</h5>
                            <p className="mt-1 text-xs text-muted-fg">
                                A blank workbook with every field we support, one per column, and an example row. Best if you
                                are starting from scratch.
                            </p>
                        </div>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={downloadingFormat === "xlsx"}
                            onClick={() => onDownloadTemplate("xlsx")}
                        >
                            {downloadingFormat === "xlsx" ? null : <Download aria-hidden="true" className="mr-2 h-4 w-4" />}
                            Excel (.xlsx)
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={downloadingFormat === "csv"}
                            onClick={() => onDownloadTemplate("csv")}
                        >
                            {downloadingFormat === "csv" ? null : <Download aria-hidden="true" className="mr-2 h-4 w-4" />}
                            CSV (.csv)
                        </Button>
                    </div>
                </section>

                <section className="flex flex-col gap-3 rounded-card border border-edge bg-surface-muted p-4">
                    <div className="flex items-start gap-2">
                        <Upload aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                        <div>
                            <h5 className="text-sm font-bold text-foreground">Upload what you already have</h5>
                            <p className="mt-1 text-xs text-muted-fg">
                                An export from your current system, or your own tracking sheet. Your column names and their
                                order do not matter — you will tell us what each one means in the next step.
                            </p>
                        </div>
                    </div>
                    <div className="mt-auto">
                        <Button type="button" size="sm" onClick={onContinue} data-testid="import-start-continue">
                            Choose a file
                        </Button>
                    </div>
                </section>
            </div>

            <p className="text-xs text-faint-fg">
                Nothing is saved until you have seen the check results and chosen to import.
            </p>
        </div>
    );
}
