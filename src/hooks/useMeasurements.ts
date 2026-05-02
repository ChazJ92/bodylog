import { useLiveQuery } from "dexie-react-hooks";
import * as svc from "@/services/measurementService";
import { useAction } from "./useAction";

export function useMeasurementsForCheckin(checkinId: string | undefined) {
  const data = useLiveQuery(
    () => (checkinId ? svc.listByCheckin(checkinId) : Promise.resolve([])),
    [checkinId],
  );
  return { data: data ?? [], isLoading: checkinId ? data === undefined : false };
}

export function useHistoryForType(typeId: string | undefined) {
  const data = useLiveQuery(
    async () => {
      if (!typeId) return [];
      const arr = await svc.historyForType(typeId);
      arr.sort((a, b) => a.recordedAt - b.recordedAt);
      return arr;
    },
    [typeId],
  );
  return { data: data ?? [], isLoading: typeId ? data === undefined : false };
}

export const useUpsertMeasurement = () => useAction(svc.upsertForCheckin);
