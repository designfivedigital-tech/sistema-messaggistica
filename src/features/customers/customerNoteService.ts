import { supabase } from "../../lib/supabase";

import type {
  CreateCustomerNoteInput,
  CustomerNote,
} from "./customerNote";

const CUSTOMER_NOTE_COLUMNS = `
  id,
  customer_id,
  conversation_id,
  message_id,
  message_body,
  message_created_at,
  body,
  created_by,
  created_at,
  operator_name,
  clockify_time_entry_id,
  clockify_project_id,
  timer_started_at,
  timer_stopped_at,
  duration_seconds
`;

export async function getCustomerNotes(): Promise<
  CustomerNote[]
> {
  const { data, error } = await supabase
    .from("customer_notes")
    .select(CUSTOMER_NOTE_COLUMNS)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Errore recupero note clienti:",
      error,
    );

    throw error;
  }

  return (data as CustomerNote[] | null) ?? [];
}

export async function createCustomerNote({
  customerId,
  conversationId,
  messageId,
  messageBody,
  messageCreatedAt,
  body,
}: CreateCustomerNoteInput): Promise<CustomerNote> {
  const normalizedBody = body.trim();

  if (!normalizedBody) {
    throw new Error("Scrivi il testo della nota.");
  }

  /*
   * created_at e created_by vengono impostati
   * dal database al momento dell'inserimento.
   */
  const { data, error } = await supabase
    .from("customer_notes")
    .insert({
      customer_id: customerId,
      conversation_id: conversationId,
      message_id: messageId,
      message_body: messageBody,
      message_created_at: messageCreatedAt,
      body: normalizedBody,
    })
    .select(CUSTOMER_NOTE_COLUMNS)
    .single();

  if (error) {
    console.error(
      "Errore creazione nota cliente:",
      error,
    );

    throw error;
  }

  return data as CustomerNote;
}
