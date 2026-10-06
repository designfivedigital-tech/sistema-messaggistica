import { supabase } from "../../lib/supabase";

import type {
  CreateCustomerNoteInput,
  CustomerNote,
} from "./customerNote";

export async function createCustomerNote({
  customerId,
  conversationId,
  messageId,
  messageBody,
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
      body: normalizedBody,
    })
    .select(
      `
        id,
        customer_id,
        conversation_id,
        message_id,
        message_body,
        body,
        created_by,
        created_at
      `,
    )
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
