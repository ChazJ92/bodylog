import { useLiveQuery } from "dexie-react-hooks";
import * as checkinSvc from "@/services/checkinService";
import * as measSvc from "@/services/measurementService";
import * as profileSvc from "@/services/profileService";
import * as measurementTypeSvc from "@/services/measurementTypeService";
import { resolveAnalysisCircumferences, type AnalysisInputs } from "@/services/analysisService";

export function useAnalysisInputs() {
  const data = useLiveQuery(async () => {
    const [latest, profile, types] = await Promise.all([
      checkinSvc.getLatest(),
      profileSvc.get(),
      measurementTypeSvc.listAll(),
    ]);
    if (!profile) return null;
    const measurements = latest ? await measSvc.listByCheckin(latest.id) : [];
    const typesById = new Map(types.map((t) => [t.id, { name: t.name }]));
    const circumferences = resolveAnalysisCircumferences(measurements, typesById);
    const inputs: AnalysisInputs = {
      sex: profile.sex,
      heightCm: profile.heightCm,
      birthYear: profile.birthYear,
      weightKg: latest?.weightKg,
      bodyFatPctManual: latest?.bodyFatPct,
      ...circumferences,
    };
    return { inputs, latest: latest ?? null, profile };
  }, []);
  return { data: data ?? null, isLoading: data === undefined };
}
