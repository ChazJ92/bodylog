import { Link } from "react-router-dom";
import { useAnalysisInputs } from "@/hooks/useAnalysisInputs";
import {
  bmi,
  bmiCategory,
  bodyFatStatus,
  fatMassKg,
  leanMassKg,
  navyBodyFat,
  waistToHeight,
  waistToHip,
  whrStatus,
  whtrStatus,
  type Status,
} from "@/services/analysisService";
import { fmtNumber } from "@/lib/format";
import { useSettings } from "@/hooks/useSettings";
import { toDisplayWeight, weightSuffix } from "@/lib/units";
import { EmptyState } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Status, string> = {
  low: "low",
  normal: "normal",
  elevated: "elevated",
  high: "high",
  unknown: "unavailable",
};

const STATUS_TONE: Record<Status, string> = {
  low: "text-warning",
  normal: "text-brand-dark",
  elevated: "text-warning",
  high: "text-destructive",
  unknown: "text-muted-foreground",
};

const STATUS_DOT: Record<Status, string> = {
  low: "bg-warning/80",
  normal: "bg-brand",
  elevated: "bg-warning/80",
  high: "bg-destructive/80",
  unknown: "bg-muted-foreground/40",
};

export default function Analysis() {
  const { data: settings } = useSettings();
  const { data } = useAnalysisInputs();

  if (!data) {
    return (
      <EmptyState
        title="Not enough data yet"
        description="Set your sex and height in Settings, then record a check-in with weight and waist/neck/hip."
        action={
          <Link to="/settings" className="btn-primary">
            Go to settings
          </Link>
        }
      />
    );
  }

  const { inputs } = data;
  const wUnit = settings?.weightUnit ?? "kg";

  const bmiVal = bmi(inputs.weightKg, inputs.heightCm);
  const navyBf = navyBodyFat(inputs);
  const manualBf = inputs.bodyFatPctManual ?? null;
  // Lean / fat mass derive from the most accurate available % — preserve
  // the original behaviour: prefer the Navy estimate, otherwise the
  // self-reported value.
  const bfForDerived = navyBf ?? manualBf;
  const lean = leanMassKg(inputs.weightKg, bfForDerived);
  const fat = fatMassKg(inputs.weightKg, bfForDerived);
  const whr = waistToHip(inputs.waistCm, inputs.hipCm);
  const whtr = waistToHeight(inputs.waistCm, inputs.heightCm);

  return (
    <div className="space-y-10">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Analysis
        </h1>
        <p className="text-sm text-muted-foreground">
          Computed from your most recent check-in. Informational, not medical advice.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Composition
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            label="BMI"
            value={bmiVal != null ? fmtNumber(bmiVal, 1) : "—"}
            status={bmiCategory(bmiVal)}
            note="weight / height²"
            accent
          />
          <Card
            label="Body fat — estimated"
            value={navyBf != null ? `${fmtNumber(navyBf, 1)}%` : "—"}
            status={bodyFatStatus(navyBf, inputs.sex)}
            note="U.S. Navy formula (waist · neck · hip)"
            accent
          />
          <Card
            label="Body fat — self-reported"
            value={manualBf != null ? `${fmtNumber(manualBf, 1)}%` : "—"}
            status={bodyFatStatus(manualBf, inputs.sex)}
            note="entered on check-in"
          />
          <Card
            label="Lean mass"
            value={lean != null ? `${fmtNumber(toDisplayWeight(lean, wUnit), 1)} ${weightSuffix(wUnit)}` : "—"}
            status="unknown"
            note="weight × (1 − bf%)"
          />
          <Card
            label="Fat mass"
            value={fat != null ? `${fmtNumber(toDisplayWeight(fat, wUnit), 1)} ${weightSuffix(wUnit)}` : "—"}
            status="unknown"
            note="weight × bf%"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ratios
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            label="Waist : Hip"
            value={whr != null ? fmtNumber(whr, 2) : "—"}
            status={whrStatus(whr, inputs.sex)}
            note="waist / hip"
          />
          <Card
            label="Waist : Height"
            value={whtr != null ? fmtNumber(whtr, 2) : "—"}
            status={whtrStatus(whtr)}
            note="waist / height"
          />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Body composition formulas are population estimates. They are not diagnostic. Patterns over time are
        more informative than any single value.
      </p>
    </div>
  );
}

function Card({
  label,
  value,
  status,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  status: Status;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-surface space-y-2.5 p-5",
        accent && "card-accent-left",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
            STATUS_TONE[status],
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="stat-number text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
