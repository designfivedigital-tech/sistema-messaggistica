import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { registerCustomer } from "./registerCustomerService";

export function useRegisterCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerCustomer,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["company-conversations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-categories"],
        }),
      ]);
    },
  });
}
