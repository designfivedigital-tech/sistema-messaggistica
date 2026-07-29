import { useQuery } from "@tanstack/react-query";
import type {
  ConversationStatus,
} from "./types";
import { supabase } from "../../lib/supabase";

export type CustomerConversation = {
  id: string;
  customer_id: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

async function getCustomerConversation(): Promise<CustomerConversation> {
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
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as CustomerConversation;
  }

  const {
    data: newConversation,
    error: createError,
  } = await supabase
    .from("conversations")
    .insert({
      customer_id: user.id,
      status: "new",
    })
    .select(
      "id, customer_id, status, created_at, updated_at",
    )
    .single();

  if (createError) {
    throw createError;
  }

  return newConversation as CustomerConversation;
}

export function useCustomerConversation() {
  return useQuery({
    queryKey: ["customer-conversation"],
    queryFn: getCustomerConversation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}