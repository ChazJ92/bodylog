import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useActiveMeasurementTypes } from "@/hooks/useMeasurementTypes";
import { useHistoryForType } from "@/hooks/useMeasurements";
import { useRecentCheckins } from "@/hooks/useCheckins";
import { useSettings } from "@/hooks/useSettings";
import { fmtDate, fmtNumber } from "@/lib/format";
import {
  altLengthFromCanonical,
  lengthSuffix,
  toDisplayLength,
  toDisplayWeight,
  weightSuffix,
} from "@/lib/units";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

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

  // `canonicalCm` is carried through for length series so both the
  // tooltip and the history list can render the alt-unit hint without
  // re-deriving the canonical value via the active display unit.
  const chartData = useMemo(() => {
    if (isWeight) {
      return checkins
        .filter((c) => c.weightKg != null)
        .map((c) => ({
          t: c.recordedAt,
          value: toDisplayWeight(c.weightKg!, wUnit),
          canonicalCm: null as number | null,
        }))
        .sort((a, b) => a.t - b.t);
    }
    return typeHistory.map((m) => ({
      t: m.recordedAt,
      value: toDisplayLength(m.valueCm, lUnit),
      canonicalCm: m.valueCm as number | null,
    }));
  }, [isWeight, checkins, typeHistory, wUnit, lUnit]);

  const unit = isWeight ? weightSuffix(wUnit) : lengthSuffix(lUnit);
  const seriesLabel = isWeight ? "Weight" : types.find((t) => t.id === series)?.name ?? "—";

  return (
    <div className="space-y-10">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Measurements
        </h1>
        <p className="text-sm text-muted-foreground">
          Lines over time. Tap a series to switch.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
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
          <div className="card-surface card-accent-top p-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bodylogLineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => fmtDate(v)}
                    stroke="#64748B"
                    tickLine={false}
                    axisLine={{ stroke: "#E5E7EB" }}
                    fontSize={11}
                    tick={{ fontFamily: "Inter", fill: "#64748B" }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#64748B"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={40}
                    tick={{ fontFamily: "Inter", fill: "#64748B" }}
                  />
                  <Tooltip
                    cursor={{ stroke: "#34D399", strokeWidth: 1, strokeOpacity: 0.4 }}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                      fontFamily: "Inter",
                      fontSize: 12,
                      color: "#0F172A",
                    }}
                    labelStyle={{ color: "#475569", fontWeight: 500 }}
                    labelFormatter={(v) => fmtDate(v as number)}
                    formatter={(v: number, _name, item) => {
                      const main = `${fmtNumber(v, 1)} ${unit}`;
                      const cm = (item as { payload?: { canonicalCm?: number | null } })
                        ?.payload?.canonicalCm;
                      if (!isWeight && cm != null) {
                        return [
                          `${main}  ≈ ${altLengthFromCanonical(cm, lUnit)}`,
                          seriesLabel,
                        ];
                      }
                      return [main, seriesLabel];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#34D399"
                    strokeWidth={2.25}
                    fill="url(#bodylogLineFill)"
                    dot={{ r: 2.5, fill: "#10B981", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#059669", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="History" />
        {chartData.length === 0 ? null : (
          <ul className="card-surface divide-y divide-border overflow-hidden">
            {[...chartData].reverse().map((p, i) => (
              <li
                key={`${p.t}-${i}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-secondary"
              >
                <span className="text-sm text-muted-foreground">{fmtDate(p.t)}</span>
                <div className="text-right">
                  <div className="stat-number text-foreground">
                    {fmtNumber(p.value, 1)}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>
                  </div>
                  {!isWeight && p.canonicalCm != null && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      ≈ {altLengthFromCanonical(p.canonicalCm, lUnit)}
                    </div>
                  )}
                </div>
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
      className={cn("chip", active && "chip-active")}
    >
      {children}
    </button>
  );
}
