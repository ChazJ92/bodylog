import { useLiveQuery } from "dexie-react-hooks";
import * as svc from "@/services/settingsService";
import { useAction } from "./useAction";

export function useSettings() {
  const data = useLiveQuery(() => svc.get(), []);
  return { data: data ?? null, isLoading: data === undefined };
}

export const useUpdateSettings = () => useAction(svc.update);
