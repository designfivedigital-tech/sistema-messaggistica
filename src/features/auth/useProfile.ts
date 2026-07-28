import { useQuery } from "@tanstack/react-query";
import { getCurrentProfile } from "./profileService";

export const profileQueryKey = ["current-profile"] as const;

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getCurrentProfile,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}