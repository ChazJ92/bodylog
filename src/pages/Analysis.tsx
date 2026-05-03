import { Link } from "react-router-dom";
import { useAnalysisInputs } from "@/hooks/useAnalysisInputs";
import {
  bmi,
  bmiCategory,
  bodyFatStatus,
  deurenbergBodyFat,
  fatMassKg,
  leanMassKg,
  navyBodyFat,
  reasonBmiUnavailable,
  reasonDeurenbergUnavailableOrGeneric,
  reasonLeanFatMassUnavailable,
  reasonManualBodyFatUnavailable,
  reasonNavyBodyFatUnavailable,
  reasonNavyBodyFatUnavailableOrGeneric,
  reasonRfmUnavailableOrGeneric,
  reasonWaistToHeightUnavailable,
  reasonWaistToHipUnavailable,
  rfmBodyFat,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

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
  const refYear = new Date().getFullYear();

  if (!data) {
    return (
      <EmptyState
        title="Profile not available"
        description="We need your profile (sex, height) from Settings before analysis can run."
        action={
          <Link to="/settings" className="btn-primary">
            Go to settings
          </Link>
        }
      />
    );
  }

  const { inputs, latest } = data;
  const wUnit = settings?.weightUnit ?? "kg";

  const bmiVal = bmi(inputs.weightKg, inputs.heightCm);
  const navyBf = navyBodyFat(inputs);
  const manualBf = inputs.bodyFatPctManual ?? null;
  const deurenbergBf = deurenbergBodyFat(inputs, refYear);
  const rfmBf = rfmBodyFat(inputs);
  // Lean / fat mass: prefer Navy estimate, otherwise self-reported % (explicit fallback).
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

      {!latest && (
        <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-muted-foreground">
          No check-in yet — add weight and measurements on a check-in to unlock most metrics.{" "}
          <Link to="/checkin" className="font-medium text-brand-dark underline-offset-2 hover:underline">
            Record check-in
          </Link>
        </div>
      )}

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
            unavailableReason={bmiVal == null ? reasonBmiUnavailable(inputs) : undefined}
            accent
          />
          <Card
            label="Body fat — estimated (Navy)"
            value={navyBf != null ? `${fmtNumber(navyBf, 1)}%` : "—"}
            status={bodyFatStatus(navyBf, inputs.sex)}
            note="U.S. Navy formula (women need waist, neck, hips)"
            unavailableReason={
              navyBf == null
                ? reasonNavyBodyFatUnavailable(inputs) ?? reasonNavyBodyFatUnavailableOrGeneric(inputs)
                : undefined
            }
            accent
          />
          <Card
            label="Body fat — self-reported"
            value={manualBf != null ? `${fmtNumber(manualBf, 1)}%` : "—"}
            status={bodyFatStatus(manualBf, inputs.sex)}
            note="entered on check-in"
            unavailableReason={
              manualBf == null ? reasonManualBodyFatUnavailable(inputs) ?? undefined : undefined
            }
          />
          <Card
            label="Body fat — Deurenberg (BMI)"
            value={deurenbergBf != null ? `${fmtNumber(deurenbergBf, 1)}%` : "—"}
            status={bodyFatStatus(deurenbergBf, inputs.sex)}
            note="BMI + age + sex (age from birth year)"
            unavailableReason={
              deurenbergBf == null
                ? reasonDeurenbergUnavailableOrGeneric(inputs, refYear)
                : undefined
            }
          />
          <Card
            label="Body fat — RFM"
            value={rfmBf != null ? `${fmtNumber(rfmBf, 1)}%` : "—"}
            status={bodyFatStatus(rfmBf, inputs.sex)}
            note="relative fat mass (height / waist)"
            unavailableReason={rfmBf == null ? reasonRfmUnavailableOrGeneric(inputs) : undefined}
          />
          <Card
            label="Lean mass"
            value={lean != null ? `${fmtNumber(toDisplayWeight(lean, wUnit), 1)} ${weightSuffix(wUnit)}` : "—"}
            status="unknown"
            note="weight × (1 − bf%); uses Navy if available, else self-reported %"
            unavailableReason={
              lean == null
                ? reasonLeanFatMassUnavailable(inputs, navyBf, manualBf) ?? undefined
                : undefined
            }
          />
          <Card
            label="Fat mass"
            value={fat != null ? `${fmtNumber(toDisplayWeight(fat, wUnit), 1)} ${weightSuffix(wUnit)}` : "—"}
            status="unknown"
            note="weight × bf%; uses Navy if available, else self-reported %"
            unavailableReason={
              fat == null
                ? reasonLeanFatMassUnavailable(inputs, navyBf, manualBf) ?? undefined
                : undefined
            }
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
            unavailableReason={
              whr == null ? reasonWaistToHipUnavailable(inputs) ?? undefined : undefined
            }
          />
          <Card
            label="Waist : Height"
            value={whtr != null ? fmtNumber(whtr, 2) : "—"}
            status={whtrStatus(whtr)}
            note="waist / height"
            unavailableReason={
              whtr == null ? reasonWaistToHeightUnavailable(inputs) ?? undefined : undefined
            }
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
  unavailableReason,
}: {
  label: string;
  value: string;
  status: Status;
  note: string;
  accent?: boolean;
  /** Shown via info popover when the metric has no value. */
  unavailableReason?: string;
}) {
  const showWhy = value === "—" && unavailableReason;

  return (
    <div
      className={cn(
        "card-surface space-y-2.5 p-5",
        accent && "card-accent-left",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {showWhy && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
                  aria-label={`Why unavailable: ${label}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="text-sm leading-snug">{unavailableReason}</PopoverContent>
            </Popover>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
              STATUS_TONE[status],
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
            {STATUS_LABEL[status]}
          </span>
        </span>
      </div>
      <div className="stat-number text-3xl">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
