import { useLiveQuery } from "dexie-react-hooks";
import * as svc from "@/services/checkinService";
import { useAction } from "./useAction";

export function useRecentCheckins(limit = 50) {
  const data = useLiveQuery(() => svc.listRecent(limit), [limit]);
  return { data: data ?? [], isLoading: data === undefined };
}

export function useLatestCheckin() {
  const data = useLiveQuery(() => svc.getLatest(), []);
  return { data: data ?? null, isLoading: data === undefined };
}

export function useCheckin(id: string | undefined) {
  const data = useLiveQuery(() => (id ? svc.getById(id) : Promise.resolve(undefined)), [id]);
  return { data: data ?? null, isLoading: id ? data === undefined : false };
}

export function usePreviousCheckin(beforeTs: number | undefined) {
  const data = useLiveQuery(
    () => (beforeTs ? svc.getPrevious(beforeTs) : Promise.resolve(undefined)),
    [beforeTs],
  );
  return { data: data ?? null, isLoading: beforeTs ? data === undefined : false };
}

export const useCreateCheckin = () => useAction(svc.createCheckin);
export const useUpdateCheckin = () => useAction(svc.updateCheckin);
export const useDeleteCheckin = () => useAction(svc.deleteCheckin);
