import { PageHeader } from "@/components/ui/page-header";

/**
 * The standard shape of every list/register page:
 * header (title, count subtitle, primary action) → toolbar (search, filter
 * chips, column controls) → DataTable. Pages compose this; they do not
 * re-invent the layout.
 */
export function ListPageTemplate({
  title,
  subtitle,
  actions,
  toolbar,
  children,
}: {
  title: string;
  /** e.g. "4,821 assets · GHS 42.6M book value" */
  subtitle?: string;
  /** Primary action buttons (Add, Export). */
  actions?: React.ReactNode;
  /** Search input + filter chips row. */
  toolbar?: React.ReactNode;
  /** Usually a DataTable. */
  children: React.ReactNode;
}) {
  return (
    <div className="page-enter space-y-4">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      {children}
    </div>
  );
}
