import { Link } from "react-router-dom";
import { useLatestCheckin, usePreviousCheckin, useRecentCheckins } from "@/hooks/useCheckins";
import { useSettings } from "@/hooks/useSettings";
import { useProfile } from "@/hooks/useProfile";
import { useMeasurementsForCheckin } from "@/hooks/useMeasurements";
import { useActiveMeasurementTypes } from "@/hooks/useMeasurementTypes";
import { toDisplayWeight, toDisplayLength, weightSuffix, lengthSuffix } from "@/lib/units";
import { fmtDate, fmtDelta, fmtNumber } from "@/lib/format";
import { bmi, bmiCategory } from "@/services/analysisService";
import { StatCard, SectionHeader, EmptyState } from "@/components/ui-bits";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { data: latest } = useLatestCheckin();
  const { data: prev } = usePreviousCheckin(latest?.recordedAt);
  const { data: recent } = useRecentCheckins(5);
  const { data: latestMeasurements } = useMeasurementsForCheckin(latest?.id);
  const { data: types } = useActiveMeasurementTypes();

  const wUnit = settings?.weightUnit ?? "kg";
  const lUnit = settings?.lengthUnit ?? "cm";

  const weightDisplay = latest?.weightKg ? toDisplayWeight(latest.weightKg, wUnit) : undefined;
  const weightDelta =
    latest?.weightKg && prev?.weightKg
      ? toDisplayWeight(latest.weightKg, wUnit) - toDisplayWeight(prev.weightKg, wUnit)
      : null;

  const bmiVal = bmi(latest?.weightKg, profile?.heightCm);
  const bmiCat = bmiCategory(bmiVal);

  const typeById = new Map(types.map((t) => [t.id, t]));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {fmtDate(Date.now())}
        </p>
        <h1 className="text-3xl">A quiet record of your body, kept by you.</h1>
      </header>

      {!latest ? (
        <EmptyState
          title="No check-ins yet"
          description="Start with weight, body fat, or any measurement. Add as little or as much as you like."
          action={
            <Link
              to="/checkin"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 font-sans text-sm text-background"
            >
              Begin first check-in <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Weight"
              value={weightDisplay != null ? fmtNumber(weightDisplay, 1) : "—"}
              unit={weightDisplay != null ? weightSuffix(wUnit) : undefined}
              delta={
                weightDelta != null ? (
                  <span
                    className={
                      weightDelta === 0
                        ? "text-muted-foreground"
                        : weightDelta < 0
                        ? "text-success"
                        : "text-warning"
                    }
                  >
                    {fmtDelta(weightDelta, 1)} {weightSuffix(wUnit)}
                  </span>
                ) : null
              }
              hint={prev ? <span>· since {fmtDate(prev.recordedAt)}</span> : null}
            />
            <StatCard
              label="BMI"
              value={bmiVal != null ? fmtNumber(bmiVal, 1) : "—"}
              hint={
                bmiVal != null ? (
                  <span className="capitalize">{bmiCat}</span>
                ) : (
                  <span>set height in Settings</span>
                )
              }
            />
            <StatCard
              label="Body fat"
              value={latest.bodyFatPct != null ? fmtNumber(latest.bodyFatPct, 1) : "—"}
              unit={latest.bodyFatPct != null ? "%" : undefined}
              hint={<span>self-reported</span>}
            />
            <StatCard
              label="Last check-in"
              value={<span className="text-2xl">{fmtDate(latest.recordedAt)}</span>}
              hint={latest.notes ? <span className="truncate">“{latest.notes}”</span> : null}
            />
          </section>

          {latestMeasurements.length > 0 && (
            <section>
              <SectionHeader title="Latest measurements" />
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {latestMeasurements.map((m) => {
                  const t = typeById.get(m.measurementTypeId);
                  if (!t) return null;
                  return (
                    <li
                      key={m.id}
                      className="rounded-md border border-border/60 bg-card px-4 py-3"
                    >
                      <div className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {t.name}
                      </div>
                      <div className="stat-number text-xl">
                        {fmtNumber(toDisplayLength(m.valueCm, lUnit), 1)}
                        <span className="ml-1 font-sans text-xs text-muted-foreground">
                          {lengthSuffix(lUnit)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <SectionHeader
              title="Recent"
              action={
                <Link to="/measurements" className="font-sans text-xs text-muted-foreground hover:text-foreground">
                  View history →
                </Link>
              }
            />
            <ul className="divide-y divide-border/60 rounded-md border border-border/60 bg-card">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/checkin/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-secondary/40"
                  >
                    <div>
                      <div className="font-medium">{fmtDate(c.recordedAt)}</div>
                      {c.notes && (
                        <div className="font-sans text-xs text-muted-foreground line-clamp-1">
                          {c.notes}
                        </div>
                      )}
                    </div>
                    <div className="stat-number text-base text-muted-foreground">
                      {c.weightKg != null
                        ? `${fmtNumber(toDisplayWeight(c.weightKg, wUnit), 1)} ${weightSuffix(wUnit)}`
                        : "—"}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
