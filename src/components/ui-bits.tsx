import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-card p-5 flex flex-col gap-2",
        className,
      )}
    >
      <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="stat-number text-4xl">{value}</span>
        {unit && <span className="font-sans text-sm text-muted-foreground">{unit}</span>}
      </div>
      {(delta || hint) && (
        <div className="font-sans text-xs text-muted-foreground flex items-center gap-2">
          {delta}
          {hint}
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-medium">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground font-sans">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
