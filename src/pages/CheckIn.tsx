import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCheckin, useCreateCheckin, useDeleteCheckin, useUpdateCheckin } from "@/hooks/useCheckins";
import { useSettings } from "@/hooks/useSettings";
import { useActiveMeasurementTypes } from "@/hooks/useMeasurementTypes";
import { useMeasurementsForCheckin, useUpsertMeasurement } from "@/hooks/useMeasurements";
import {
  altLengthFromRaw,
  convertLengthDisplayValue,
  convertWeightDisplayValue,
  displayLengthRange,
  displayWeightRange,
  fromDisplayLength,
  fromDisplayWeight,
  lengthSuffix,
  toDisplayLength,
  toDisplayWeight,
  weightSuffix,
} from "@/lib/units";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import {
  RANGES,
  measurementValueSchema,
  checkinPayloadSchema,
} from "@/lib/validationSchemas";
import type { LengthUnit, WeightUnit } from "@/db/db";

type FormState = {
  recordedAt: string;
  weight: string;
  bodyFat: string;
  notes: string;
  measurements: Record<string, string>;
};

export default function CheckIn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { data: settings } = useSettings();
  const { data: types } = useActiveMeasurementTypes();
  const { data: existing } = useCheckin(id);
  const { data: existingMeasurements } = useMeasurementsForCheckin(id);

  const wUnit = settings?.weightUnit ?? "kg";
  const lUnit = settings?.lengthUnit ?? "cm";

  const [form, setForm] = useState<FormState>({
    recordedAt: toDateInputValue(Date.now()),
    weight: "",
    bodyFat: "",
    notes: "",
    measurements: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hydrate from the persisted check-in. Re-runs only when the underlying
  // record reference changes — unit toggles are handled by the dedicated
  // conversion effects below so that in-progress typing is preserved.
  useEffect(() => {
    if (!isEdit) return;
    if (!existing) return;
    setForm((f) => ({
      ...f,
      recordedAt: toDateInputValue(existing.recordedAt),
      weight: existing.weightKg != null ? toDisplayWeight(existing.weightKg, wUnit).toFixed(1) : "",
      bodyFat: existing.bodyFatPct != null ? String(existing.bodyFatPct) : "",
      notes: existing.notes ?? "",
    }));
    // wUnit intentionally omitted: the unit-conversion effect handles toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing]);

  useEffect(() => {
    if (!isEdit) return;
    const map: Record<string, string> = {};
    for (const m of existingMeasurements) {
      map[m.measurementTypeId] = toDisplayLength(m.valueCm, lUnit).toFixed(1);
    }
    setForm((f) => ({ ...f, measurements: { ...map, ...f.measurements } }));
    // lUnit intentionally omitted: the unit-conversion effect handles toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existingMeasurements.length]);

  // Re-display in-progress form values when the user toggles units. We
  // round-trip through the canonical kg/cm so that the underlying value is
  // never altered by the toggle itself — only the displayed string changes.
  // Stored data is therefore never touched until submit.
  const wUnitRef = useRef<WeightUnit>(wUnit);
  useEffect(() => {
    if (wUnitRef.current === wUnit) return;
    const fromUnit = wUnitRef.current;
    wUnitRef.current = wUnit;
    setForm((f) => {
      const next = convertWeightDisplayValue(f.weight, fromUnit, wUnit);
      return next === f.weight ? f : { ...f, weight: next };
    });
  }, [wUnit]);

  const lUnitRef = useRef<LengthUnit>(lUnit);
  useEffect(() => {
    if (lUnitRef.current === lUnit) return;
    const fromUnit = lUnitRef.current;
    lUnitRef.current = lUnit;
    setForm((f) => {
      let mutated = false;
      const nextMeasurements: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.measurements)) {
        const converted = convertLengthDisplayValue(v, fromUnit, lUnit);
        if (converted !== v) mutated = true;
        nextMeasurements[k] = converted;
      }
      return mutated ? { ...f, measurements: nextMeasurements } : f;
    });
  }, [lUnit]);

  const create = useCreateCheckin();
  const update = useUpdateCheckin();
  const del = useDeleteCheckin();
  const upsertMeas = useUpsertMeasurement();

  const submitting = create.isSubmitting || update.isSubmitting || upsertMeas.isSubmitting;

  const validate = (): { ok: boolean; errs: Record<string, string> } => {
    const errs: Record<string, string> = {};
    let weightKg: number | undefined;
    let bodyFatPct: number | undefined;

    if (form.weight.trim()) {
      const w = Number(form.weight);
      if (!Number.isFinite(w)) {
        errs.weight = "Enter a number";
      } else {
        weightKg = fromDisplayWeight(w, wUnit);
      }
    }
    if (form.bodyFat.trim()) {
      const bf = Number(form.bodyFat);
      if (!Number.isFinite(bf)) errs.bodyFat = "Enter a number";
      else bodyFatPct = bf;
    }

    // Run the centralized schema once for the check-in payload so error
    // messages align with the canonical spec (2–80% body fat, 20–400 kg
    // weight, 500-char notes max).
    const payload = checkinPayloadSchema.safeParse({
      recordedAt: fromDateInputValue(form.recordedAt),
      weightKg,
      bodyFatPct,
      notes: form.notes,
    });
    if (!payload.success) {
      for (const issue of payload.error.issues) {
        const field = issue.path[0];
        if (field === "weightKg" && !errs.weight) {
          errs.weight = `Out of range (${displayWeightRange(
            RANGES.weightKg.min,
            RANGES.weightKg.max,
            wUnit,
          )})`;
        } else if (field === "bodyFatPct" && !errs.bodyFat) {
          errs.bodyFat = `${RANGES.bodyFatPctManual.min}–${RANGES.bodyFatPctManual.max}%`;
        } else if (field === "notes") {
          errs.notes = `Max ${RANGES.notesMaxLen} characters`;
        }
      }
    }

    for (const [tid, raw] of Object.entries(form.measurements)) {
      if (!raw.trim()) continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) {
        errs[`m_${tid}`] = "Number";
        continue;
      }
      const cm = fromDisplayLength(v, lUnit);
      const r = measurementValueSchema.safeParse(cm);
      if (!r.success) {
        errs[`m_${tid}`] = displayLengthRange(
          RANGES.measurementCm.min,
          RANGES.measurementCm.max,
          lUnit,
        );
      }
    }
    return { ok: Object.keys(errs).length === 0, errs };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { ok, errs } = validate();
    setErrors(errs);
    if (!ok) return;

    const recordedAt = fromDateInputValue(form.recordedAt);
    const weightKg = form.weight.trim() ? fromDisplayWeight(Number(form.weight), wUnit) : undefined;
    const bodyFatPct = form.bodyFat.trim() ? Number(form.bodyFat) : undefined;
    const notes = form.notes;

    try {
      let checkinId = id;
      if (isEdit && id) {
        await update.run(id, { recordedAt, weightKg, bodyFatPct, notes });
      } else {
        const c = await create.run({ recordedAt, weightKg, bodyFatPct, notes });
        checkinId = c.id;
      }
      if (checkinId) {
        for (const t of types) {
          const raw = form.measurements[t.id];
          const cm = raw && raw.trim() ? fromDisplayLength(Number(raw), lUnit) : undefined;
          await upsertMeas.run(checkinId, recordedAt, t.id, cm);
        }
      }
      toast.success(isEdit ? "Check-in updated" : "Check-in saved");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const onDelete = async () => {
    if (!id) return;
    if (!confirm("Delete this check-in? Photos linked to it will be unlinked but kept.")) return;
    try {
      await del.run(id);
      toast.success("Check-in deleted");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const sortedTypes = useMemo(() => types, [types]);

  return (
    <form onSubmit={onSubmit} className="space-y-10" noValidate>
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {isEdit ? "Edit check-in" : "New check-in"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Skip any field. The fewer fields, the easier the habit.
        </p>
      </header>

      <section className="card-surface space-y-5 p-6">
        <Field label="When" htmlFor="recordedAt">
          <input
            id="recordedAt"
            type="datetime-local"
            value={form.recordedAt}
            onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
            className={inputCls}
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Weight (${weightSuffix(wUnit)})`} htmlFor="weight" error={errors.weight}>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className={inputCls}
              placeholder="—"
            />
          </Field>
          <Field label="Body fat (%)" htmlFor="bodyFat" error={errors.bodyFat}>
            <input
              id="bodyFat"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.bodyFat}
              onChange={(e) => setForm({ ...form, bodyFat: e.target.value })}
              className={inputCls}
              placeholder="—"
            />
          </Field>
        </div>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Measurements ({lengthSuffix(lUnit)})
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedTypes.map((t) => {
            const raw = form.measurements[t.id] ?? "";
            const altHint = altLengthFromRaw(raw, lUnit);
            return (
              <Field key={t.id} label={t.name} htmlFor={`m_${t.id}`} error={errors[`m_${t.id}`]}>
                <input
                  id={`m_${t.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={raw}
                  onChange={(e) =>
                    setForm({ ...form, measurements: { ...form.measurements, [t.id]: e.target.value } })
                  }
                  className={inputCls}
                  placeholder="—"
                />
                {altHint && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    ≈ {altHint}
                  </span>
                )}
              </Field>
            );
          })}
        </div>
      </section>

      <section className="card-surface p-6">
        <Field label="Notes" htmlFor="notes" error={errors.notes}>
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${inputCls} resize-y`}
            placeholder="How you felt, training context, anything worth remembering."
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Save check-in"}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-secondary"
        >
          Cancel
        </button>
        {isEdit && (
          <button type="button" onClick={onDelete} className="btn-danger ml-auto">
            Delete check-in
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls = "input-base";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}
