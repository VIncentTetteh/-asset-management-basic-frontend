import { cn } from "@/lib/utils";

/**
 * Groups related fields under a labelled section inside create/edit forms —
 * the one sanctioned way to structure long forms, so every module's forms
 * read the same.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-4", className)}>
      <div className="border-b border-edge-subtle pb-2">
        <legend className="text-sm font-bold text-foreground">{title}</legend>
        {description ? <p className="mt-0.5 text-[13px] text-muted-fg">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
