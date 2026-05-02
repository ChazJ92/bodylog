import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import {
  useActiveMeasurementTypes,
  useAllMeasurementTypes,
  useCreateMeasurementType,
  useRenameMeasurementType,
  useSetMeasurementTypeActive,
} from "@/hooks/useMeasurementTypes";
import { fromDisplayLength, lengthSuffix, toDisplayLength } from "@/lib/units";
import * as exportImport from "@/services/exportImportService";
import type { LengthUnit, Sex, WeightUnit } from "@/db/db";
import { SectionHeader } from "@/components/ui-bits";
import { Trash2 } from "lucide-react";

export default function Settings() {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();

  const wUnit = settings?.weightUnit ?? "kg";
  const lUnit = settings?.lengthUnit ?? "cm";

  const [heightInput, setHeightInput] = useState("");
  useEffect(() => {
    if (profile?.heightCm) {
      setHeightInput(toDisplayLength(profile.heightCm, lUnit).toFixed(1));
    } else {
      setHeightInput("");
    }
  }, [profile?.heightCm, lUnit]);

  const onHeightBlur = async () => {
    const v = Number(heightInput);
    if (!heightInput.trim()) {
      await updateProfile.run({ heightCm: undefined });
      return;
    }
    if (!Number.isFinite(v)) return;
    const cm = fromDisplayLength(v, lUnit);
    await updateProfile.run({ heightCm: cm });
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl">Settings</h1>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Everything here lives only on this device.
        </p>
      </header>

      <section className="space-y-4">
        <SectionHeader title="Profile" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-sans">
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
          <FieldLabel label={`Height (${lengthSuffix(lUnit)})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={onHeightBlur}
              className={inputCls}
              placeholder="—"
            />
          </FieldLabel>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Units" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-sans">
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
  const { data: all } = useAllMeasurementTypes();
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
    <section className="space-y-4">
      <SectionHeader title="Measurement types" />
      <p className="font-sans text-xs text-muted-foreground -mt-2">
        Disabled types stay in history but won't appear on new check-ins. Built-in types can't be deleted.
      </p>
      <ul className="divide-y divide-border/60 rounded-md border border-border/60 bg-card font-sans">
        {all.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <input
              defaultValue={t.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== t.name) {
                  rename.run(t.id, e.target.value);
                }
              }}
              className="flex-1 bg-transparent text-sm outline-none focus:ring-1 focus:ring-ring rounded px-1"
            />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {t.isBuiltIn ? "built-in" : "custom"}
            </span>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.isActive}
                onChange={(e) => setActive.run(t.id, e.target.checked)}
              />
              active
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 font-sans">
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
          className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
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
    <section className="space-y-4">
      <SectionHeader title="Your data" />
      <p className="font-sans text-xs text-muted-foreground -mt-2">
        All data lives in this browser's IndexedDB. Export to a JSON file as your backup.
      </p>
      <div className="flex flex-wrap gap-2 font-sans">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50"
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
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> Erase all data
        </button>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
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
    <div className="inline-flex rounded-full border border-border p-1 bg-background">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "rounded-full px-4 py-1 text-xs uppercase tracking-[0.15em] transition-colors " +
            (value === o.v ? "bg-foreground text-background" : "text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
