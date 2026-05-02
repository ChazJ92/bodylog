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
  normal: "text-success",
  elevated: "text-warning",
  high: "text-destructive",
  unknown: "text-muted-foreground",
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
          <Link to="/settings" className="text-sm underline">
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
  const bfDisplay = navyBf ?? inputs.bodyFatPctManual ?? null;
  const bfSource = navyBf != null ? "U.S. Navy formula" : inputs.bodyFatPctManual != null ? "self-reported" : "—";
  const lean = leanMassKg(inputs.weightKg, bfDisplay);
  const fat = fatMassKg(inputs.weightKg, bfDisplay);
  const whr = waistToHip(inputs.waistCm, inputs.hipCm);
  const whtr = waistToHeight(inputs.waistCm, inputs.heightCm);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Analysis</h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Computed from your most recent check-in. Informational, not medical advice.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          label="BMI"
          value={bmiVal != null ? fmtNumber(bmiVal, 1) : "—"}
          status={bmiCategory(bmiVal)}
          note="weight / height²"
        />
        <Card
          label="Body fat"
          value={bfDisplay != null ? `${fmtNumber(bfDisplay, 1)}%` : "—"}
          status={bodyFatStatus(bfDisplay, inputs.sex)}
          note={bfSource}
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

      <p className="font-sans text-xs text-muted-foreground">
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
}: {
  label: string;
  value: string;
  status: Status;
  note: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card p-5 space-y-2">
      <div className="flex items-center justify-between font-sans">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className={cn("text-[10px] uppercase tracking-[0.18em]", STATUS_TONE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="stat-number text-3xl">{value}</div>
      <div className="font-sans text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
