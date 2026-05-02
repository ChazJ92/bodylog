import { useLiveQuery } from "dexie-react-hooks";
import * as checkinSvc from "@/services/checkinService";
import * as measSvc from "@/services/measurementService";
import * as profileSvc from "@/services/profileService";
import type { AnalysisInputs } from "@/services/analysisService";

export function useAnalysisInputs() {
  const data = useLiveQuery(async () => {
    const [latest, profile] = await Promise.all([checkinSvc.getLatest(), profileSvc.get()]);
    if (!profile) return null;
    const measurements = latest ? await measSvc.listByCheckin(latest.id) : [];
    const byType = new Map(measurements.map((m) => [m.measurementTypeId, m.valueCm]));
    const inputs: AnalysisInputs = {
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: latest?.weightKg,
      bodyFatPctManual: latest?.bodyFatPct,
      waistCm: byType.get("waist"),
      neckCm: byType.get("neck"),
      hipCm: byType.get("hips") ?? byType.get("hip"),
    };
    return { inputs, latest: latest ?? null, profile };
  }, []);
  return { data: data ?? null, isLoading: data === undefined };
}
