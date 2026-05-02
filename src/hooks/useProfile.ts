import { useLiveQuery } from "dexie-react-hooks";
import * as svc from "@/services/profileService";
import { useAction } from "./useAction";

export function useProfile() {
  const data = useLiveQuery(() => svc.get(), []);
  return { data: data ?? null, isLoading: data === undefined };
}

export const useUpdateProfile = () => useAction(svc.update);
