import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The standard empty state: an invitation to act, not a dead end.
 * Pass `action` (usually a Button) whenever the user can create the thing.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-faint-fg">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-muted-fg">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
