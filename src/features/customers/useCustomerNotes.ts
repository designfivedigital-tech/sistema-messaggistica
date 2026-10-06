import { useQuery } from "@tanstack/react-query";

import { getCustomerNotes } from "./customerNoteService";

export function useCustomerNotes() {
  return useQuery({
    queryKey: ["customer-notes"],
    queryFn: getCustomerNotes,
    staleTime: 30_000,
    retry: 1,
  });
}
