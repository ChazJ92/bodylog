import { useLiveQuery } from "dexie-react-hooks";
import * as svc from "@/services/measurementTypeService";
import { useAction } from "./useAction";

export function useActiveMeasurementTypes() {
  const data = useLiveQuery(() => svc.listActive(), []);
  return { data: data ?? [], isLoading: data === undefined };
}

export function useAllMeasurementTypes() {
  const data = useLiveQuery(() => svc.listAll(), []);
  return { data: data ?? [], isLoading: data === undefined };
}

export function useManageableMeasurementTypes() {
  const data = useLiveQuery(() => svc.listManageable(), []);
  return { data: data ?? [], isLoading: data === undefined };
}

export const useCreateMeasurementType = () => useAction(svc.createType);
export const useRenameMeasurementType = () => useAction(svc.renameType);
export const useSetMeasurementTypeActive = () => useAction(svc.setActive);
