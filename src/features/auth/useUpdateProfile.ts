import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { updateCurrentProfile } from "./profileService";
import { profileQueryKey } from "./useProfile";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCurrentProfile,

    onSuccess: async (profile) => {
      queryClient.setQueryData(
        profileQueryKey,
        profile,
      );

      await queryClient.invalidateQueries({
        queryKey: ["company-conversations"],
      });
    },
  });
}