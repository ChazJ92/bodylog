import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
  className,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  hint?: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-surface flex flex-col gap-2.5 p-5",
        accent && "card-accent-top",
        className,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="stat-number text-[2.25rem] leading-none">{value}</span>
        {unit && (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-secondary p-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
