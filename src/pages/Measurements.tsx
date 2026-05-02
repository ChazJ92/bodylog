import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useActiveMeasurementTypes } from "@/hooks/useMeasurementTypes";
import { useHistoryForType } from "@/hooks/useMeasurements";
import { useRecentCheckins } from "@/hooks/useCheckins";
import { useSettings } from "@/hooks/useSettings";
import { fmtDate, fmtNumber } from "@/lib/format";
import { lengthSuffix, toDisplayLength, toDisplayWeight, weightSuffix } from "@/lib/units";
import { EmptyState, SectionHeader } from "@/components/ui-bits";

type Series = "weight" | string; // typeId

export default function Measurements() {
  const { data: settings } = useSettings();
  const { data: types } = useActiveMeasurementTypes();
  const { data: checkins } = useRecentCheckins(500);
  const [series, setSeries] = useState<Series>("weight");

  const wUnit = settings?.weightUnit ?? "kg";
  const lUnit = settings?.lengthUnit ?? "cm";

  const isWeight = series === "weight";
  const { data: typeHistory } = useHistoryForType(isWeight ? undefined : series);

  const chartData = useMemo(() => {
    if (isWeight) {
      return checkins
        .filter((c) => c.weightKg != null)
        .map((c) => ({ t: c.recordedAt, value: toDisplayWeight(c.weightKg!, wUnit) }))
        .sort((a, b) => a.t - b.t);
    }
    return typeHistory.map((m) => ({ t: m.recordedAt, value: toDisplayLength(m.valueCm, lUnit) }));
  }, [isWeight, checkins, typeHistory, wUnit, lUnit]);

  const unit = isWeight ? weightSuffix(wUnit) : lengthSuffix(lUnit);
  const seriesLabel = isWeight ? "Weight" : types.find((t) => t.id === series)?.name ?? "—";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Measurements</h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Lines over time. Tap a series to switch.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 font-sans">
        <Chip active={isWeight} onClick={() => setSeries("weight")}>Weight</Chip>
        {types.map((t) => (
          <Chip key={t.id} active={series === t.id} onClick={() => setSeries(t.id)}>
            {t.name}
          </Chip>
        ))}
      </div>

      <section>
        <SectionHeader title={`${seriesLabel} (${unit})`} />
        {chartData.length === 0 ? (
          <EmptyState title="No data yet" description="Add a check-in to start the line." />
        ) : (
          <div className="rounded-md border border-border/60 bg-card p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => fmtDate(v)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tick={{ fontFamily: "Inter" }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={36}
                    tick={{ fontFamily: "Inter" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontFamily: "Inter",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => fmtDate(v as number)}
                    formatter={(v: number) => [`${fmtNumber(v, 1)} ${unit}`, seriesLabel]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "hsl(var(--accent))" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="History" />
        {chartData.length === 0 ? null : (
          <ul className="divide-y divide-border/60 rounded-md border border-border/60 bg-card font-sans">
            {[...chartData].reverse().map((p, i) => (
              <li key={`${p.t}-${i}`} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">{fmtDate(p.t)}</span>
                <span className="stat-number">
                  {fmtNumber(p.value, 1)}
                  <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.15em] transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
