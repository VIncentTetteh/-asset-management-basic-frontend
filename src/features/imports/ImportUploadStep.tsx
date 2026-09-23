"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { StepError, StepHeading } from "@/features/imports/WizardChrome";
import {
    IMPORT_FILE_ACCEPT,
    IMPORT_MAX_FILE_BYTES,
    formatBytes,
    rejectImportFile,
} from "@/features/imports/importFile";

const INPUT_ID = "import-wizard-file";
const ERROR_ID = "import-wizard-file-error";

/**
 * File choice. Drag-and-drop is a convenience layered over a real
 * `<input type="file">` with a real `<label>`, so the step is fully usable
 * from the keyboard and the rejection message is tied to the control.
 */
export function ImportUploadStep({
    file,
    onFileChosen,
    onAnalyse,
    onBack,
    isAnalysing,
    analyseError,
}: {
    file: File | null;
    onFileChosen: (file: File | null) => void;
    onAnalyse: () => void;
    onBack: () => void;
    isAnalysing: boolean;
    analyseError: string | null;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [rejection, setRejection] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const accept = (chosen: File | null | undefined) => {
        if (!chosen) {
            setRejection(null);
            onFileChosen(null);
            return;
        }
        const problem = rejectImportFile(chosen);
        setRejection(problem);
        onFileChosen(problem ? null : chosen);
    };

    return (
        <div className="space-y-5">
            <StepHeading hint="Excel (.xlsx) or CSV, up to 25 MB. The first row must be your column headings.">
                Upload your spreadsheet
            </StepHeading>

            <div className="space-y-2">
                <Label htmlFor={INPUT_ID}>Spreadsheet file</Label>
                <div
                    onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                        accept(event.dataTransfer?.files?.[0]);
                    }}
                    className={cn(
                        "rounded-card border border-dashed p-5 text-center transition-colors",
                        isDragging ? "border-brand bg-brand/5" : "border-edge bg-surface-muted",
                    )}
                >
                    <FileSpreadsheet aria-hidden="true" className="mx-auto mb-2 h-7 w-7 text-faint-fg" />
                    <p className="text-sm text-muted-fg">
                        Drag a file here, or{" "}
                        <button
                            type="button"
                            className="ea-focus rounded-sm font-semibold text-brand underline"
                            onClick={() => inputRef.current?.click()}
                        >
                            browse your computer
                        </button>
                        .
                    </p>
                    <input
                        id={INPUT_ID}
                        ref={inputRef}
                        type="file"
                        accept={IMPORT_FILE_ACCEPT}
                        aria-invalid={rejection ? true : undefined}
                        aria-describedby={rejection ? ERROR_ID : undefined}
                        data-testid="import-file-input"
                        className="mx-auto mt-3 block w-full max-w-sm cursor-pointer text-sm text-muted-fg file:mr-3 file:rounded-control file:border file:border-edge file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground"
                        onChange={(event) => accept(event.target.files?.[0] ?? null)}
                    />
                </div>
                <FieldError id={ERROR_ID} error={rejection ? { message: rejection } : null} />
                {file ? (
                    <p data-testid="import-chosen-file" className="text-xs text-muted-fg">
                        Selected: <span className="font-semibold text-foreground">{file.name}</span> ({formatBytes(file.size)})
                    </p>
                ) : (
                    <p className="text-xs text-faint-fg">Maximum {formatBytes(IMPORT_MAX_FILE_BYTES)}.</p>
                )}
            </div>

            {analyseError ? <StepError message={analyseError} /> : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-edge-subtle pt-3">
                <Button type="button" variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button
                    type="button"
                    onClick={onAnalyse}
                    disabled={!file}
                    isLoading={isAnalysing}
                    data-testid="import-analyse"
                >
                    {isAnalysing ? null : <Upload aria-hidden="true" className="mr-2 h-4 w-4" />}
                    Read my columns
                </Button>
            </div>
        </div>
    );
}
