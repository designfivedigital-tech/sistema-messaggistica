import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { CustomerCategory } from "./customerCategory";
import {
  getCustomerCategories,
  setCustomerCategory,
} from "./customerCategoryService";

type SetCustomerCategoryVariables = {
  customerId: string;
  category: CustomerCategory | null;
};

const customerCategoriesKey = [
  "customer-categories",
] as const;

export function useCustomerCategories() {
  return useQuery({
    queryKey: customerCategoriesKey,
    queryFn: getCustomerCategories,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSetCustomerCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      category,
    }: SetCustomerCategoryVariables) =>
      setCustomerCategory(customerId, category),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerCategoriesKey,
      });
    },
  });
}
