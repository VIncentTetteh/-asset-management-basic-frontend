import { cn } from "@/lib/utils";

/**
 * Signature element: an asset tag rendered as the physical object it
 * represents — mono type in a chip with a punch-hole, like the foil tag on
 * the asset itself. Use for asset tags, serial numbers stay plain .data-mono.
 */
export function AssetTag({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={cn(
        "data-mono relative inline-flex items-center rounded-[3px] border border-edge",
        "bg-surface-sunken py-0.5 pl-3.5 pr-2 text-[11.5px] leading-4 text-foreground/80",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute left-[5px] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-faint-fg"
      />
      {tag}
    </span>
  );
}
