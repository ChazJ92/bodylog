import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCheckin, useCreateCheckin, useDeleteCheckin, useUpdateCheckin } from "@/hooks/useCheckins";
import { useSettings } from "@/hooks/useSettings";
import { useActiveMeasurementTypes } from "@/hooks/useMeasurementTypes";
import { useMeasurementsForCheckin, useUpsertMeasurement } from "@/hooks/useMeasurements";
import {
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

  // Hydrate when editing
  useEffect(() => {
    if (!isEdit) return;
    if (!existing) return;
    setForm((f) => ({
      ...f,
      recordedAt: toDateInputValue(existing.recordedAt),
      weight: existing.weightKg != null ? String(toDisplayWeight(existing.weightKg, wUnit).toFixed(1)) : "",
      bodyFat: existing.bodyFatPct != null ? String(existing.bodyFatPct) : "",
      notes: existing.notes ?? "",
    }));
  }, [isEdit, existing, wUnit]);

  useEffect(() => {
    if (!isEdit) return;
    const map: Record<string, string> = {};
    for (const m of existingMeasurements) {
      map[m.measurementTypeId] = toDisplayLength(m.valueCm, lUnit).toFixed(1);
    }
    setForm((f) => ({ ...f, measurements: { ...map, ...f.measurements } }));
    // we only seed once per data load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existingMeasurements.length, lUnit]);

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
          errs.weight = `Out of range (${RANGES.weightKg.min}–${RANGES.weightKg.max} kg)`;
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
        errs[`m_${tid}`] = `${RANGES.measurementCm.min}–${RANGES.measurementCm.max} cm`;
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
    <form onSubmit={onSubmit} className="space-y-8 font-sans" noValidate>
      <header>
        <h1 className="font-serif text-3xl">{isEdit ? "Edit check-in" : "New check-in"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Skip any field. The fewer fields, the easier the habit.
        </p>
      </header>

      <section className="space-y-4">
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

      <section>
        <h2 className="font-serif text-xl mb-3">Measurements ({lengthSuffix(lUnit)})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedTypes.map((t) => (
            <Field key={t.id} label={t.name} htmlFor={`m_${t.id}`} error={errors[`m_${t.id}`]}>
              <input
                id={`m_${t.id}`}
                type="number"
                inputMode="decimal"
                step="0.1"
                value={form.measurements[t.id] ?? ""}
                onChange={(e) =>
                  setForm({ ...form, measurements: { ...form.measurements, [t.id]: e.target.value } })
                }
                className={inputCls}
                placeholder="—"
              />
            </Field>
          ))}
        </div>
      </section>

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

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm text-background disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Save check-in"}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-border px-5 py-2.5 text-sm hover:bg-secondary"
        >
          Cancel
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-sm text-destructive hover:underline"
          >
            Delete check-in
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

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
      <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
