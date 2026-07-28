import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabase";

export type CustomerConversation = {
  id: string;
  customer_id: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
};

async function getCustomerConversation(): Promise<
  CustomerConversation
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, status, created_at, updated_at",
    )
    .eq("customer_id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data as CustomerConversation;
}

export function useCustomerConversation() {
  return useQuery({
    queryKey: ["customer-conversation"],
    queryFn: getCustomerConversation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}