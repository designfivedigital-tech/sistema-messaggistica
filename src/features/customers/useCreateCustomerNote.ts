import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { createCustomerNote } from "./customerNoteService";

export function useCreateCustomerNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomerNote,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-notes"],
      });
    },
  });
}
