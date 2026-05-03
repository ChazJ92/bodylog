import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import {
  useCreateMeasurementType,
  useManageableMeasurementTypes,
  useRenameMeasurementType,
  useSetMeasurementTypeActive,
} from "@/hooks/useMeasurementTypes";
import {
  convertLengthDisplayValue,
  displayLengthRange,
  fromDisplayLength,
  lengthSuffix,
  toDisplayLength,
} from "@/lib/units";
import { RANGES } from "@/lib/validationSchemas";
import * as exportImport from "@/services/exportImportService";
import type { LengthUnit, Sex, WeightUnit } from "@/db/db";
import { SectionHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export default function Settings() {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();

  const wUnit = settings?.weightUnit ?? "kg";
  const lUnit = settings?.lengthUnit ?? "cm";

  const [heightInput, setHeightInput] = useState("");
  const [heightError, setHeightError] = useState<string | null>(null);

  // Re-seed the input when the persisted profile height changes. Unit
  // toggles are handled by the dedicated conversion effect below so that
  // any in-progress typing is preserved across cm <-> in.
  useEffect(() => {
    if (profile?.heightCm) {
      setHeightInput(toDisplayLength(profile.heightCm, lUnit).toFixed(1));
    } else {
      setHeightInput("");
    }
    setHeightError(null);
    // lUnit intentionally omitted: see lUnitRef effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.heightCm]);

  const lUnitRef = useRef<LengthUnit>(lUnit);
  useEffect(() => {
    if (lUnitRef.current === lUnit) return;
    const fromUnit = lUnitRef.current;
    lUnitRef.current = lUnit;
    setHeightError(null);
    setHeightInput((cur) => convertLengthDisplayValue(cur, fromUnit, lUnit));
  }, [lUnit]);

  const onHeightBlur = async () => {
    setHeightError(null);
    if (!heightInput.trim()) {
      try {
        await updateProfile.run({ heightCm: undefined });
      } catch (e) {
        setHeightError(e instanceof Error ? e.message : "Failed to save");
      }
      return;
    }
    const v = Number(heightInput);
    if (!Number.isFinite(v)) {
      setHeightError("Enter a number");
      return;
    }
    const cm = fromDisplayLength(v, lUnit);
    if (cm < RANGES.heightCm.min || cm > RANGES.heightCm.max) {
      setHeightError(
        `Out of range (${displayLengthRange(
          RANGES.heightCm.min,
          RANGES.heightCm.max,
          lUnit,
        )})`,
      );
      return;
    }
    try {
      await updateProfile.run({ heightCm: cm });
    } catch (e) {
      setHeightError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything here lives only on this device.
        </p>
      </header>

      <section className="card-surface space-y-5 p-6">
        <SectionHeader title="Profile" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Sex (for body-comp formulas)">
            <select
              value={profile?.sex ?? "other"}
              onChange={(e) => updateProfile.run({ sex: e.target.value as Sex })}
              className={inputCls}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Prefer not to say</option>
            </select>
          </FieldLabel>
          <FieldLabel label={`Height (${lengthSuffix(lUnit)})`} error={heightError}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={heightInput}
              onChange={(e) => {
                setHeightInput(e.target.value);
                if (heightError) setHeightError(null);
              }}
              onBlur={onHeightBlur}
              className={inputCls}
              placeholder="—"
            />
          </FieldLabel>
        </div>
      </section>

      <section className="card-surface space-y-5 p-6">
        <SectionHeader title="Units" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Weight">
            <Toggle
              value={wUnit}
              options={[
                { v: "kg" as WeightUnit, label: "kg" },
                { v: "lb" as WeightUnit, label: "lb" },
              ]}
              onChange={(v) => updateSettings.run({ weightUnit: v })}
            />
          </FieldLabel>
          <FieldLabel label="Length">
            <Toggle
              value={lUnit}
              options={[
                { v: "cm" as LengthUnit, label: "cm" },
                { v: "in" as LengthUnit, label: "in" },
              ]}
              onChange={(v) => updateSettings.run({ lengthUnit: v })}
            />
          </FieldLabel>
        </div>
      </section>

      <MeasurementTypesPanel />
      <DataPanel />
    </div>
  );
}

function MeasurementTypesPanel() {
  const { data: all } = useManageableMeasurementTypes();
  const create = useCreateMeasurementType();
  const rename = useRenameMeasurementType();
  const setActive = useSetMeasurementTypeActive();
  const [name, setName] = useState("");

  const onAdd = async () => {
    if (!name.trim()) return;
    try {
      await create.run(name);
      setName("");
      toast.success("Added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <section className="card-surface space-y-4 p-6">
      <SectionHeader title="Measurement types" />
      <p className="-mt-2 text-xs text-muted-foreground">
        Disabled types stay in history but won't appear on new check-ins. Built-in types can't be deleted.
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-secondary">
        {all.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-surface-secondary"
          >
            <input
              defaultValue={t.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== t.name) {
                  rename.run(t.id, e.target.value);
                }
              }}
              className="flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none transition-shadow focus:ring-2 focus:ring-brand/40"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t.isBuiltIn ? "built-in" : "custom"}
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={t.isActive}
                onChange={(e) => setActive.run(t.id, e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand accent-brand focus:ring-brand"
              />
              active
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a custom measurement (e.g. Calf)"
          className={inputCls}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!name.trim() || create.isSubmitting}
          className="btn-primary"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const json = await exportImport.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file: File) => {
    if (!confirm("Import will replace all current data on this device. Continue?")) return;
    setBusy(true);
    try {
      const text = await file.text();
      await exportImport.importAll(text);
      toast.success("Imported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onClear = async () => {
    const c1 = confirm("Erase all data on this device? This cannot be undone.");
    if (!c1) return;
    const c2 = prompt('Type "ERASE" to confirm');
    if (c2 !== "ERASE") return;
    setBusy(true);
    try {
      await exportImport.clearAll();
      toast.success("All data erased");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-surface space-y-4 p-6">
      <SectionHeader title="Your data" />
      <p className="-mt-2 text-xs text-muted-foreground">
        All data lives in this browser's IndexedDB. Export to a JSON file as your backup.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="btn-secondary"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-secondary"
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
          }}
        />
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="btn-danger ml-auto"
        >
          <Trash2 className="h-4 w-4" /> Erase all data
        </button>
      </div>
    </section>
  );
}

const inputCls = "input-base";

function FieldLabel({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface-secondary p-1">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-all",
              active
                ? "bg-brand-gradient text-white shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
