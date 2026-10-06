export type CustomerNote = {
  id: string;
  customer_id: string;
  conversation_id: string | null;
  message_id: string | null;

  /*
   * Copia del testo del messaggio a cui la nota
   * si riferisce: resta leggibile anche se il
   * messaggio o la conversazione vengono eliminati.
   */
  message_body: string | null;

  /* Data di invio del messaggio annotato. */
  message_created_at: string | null;

  body: string;
  created_by: string | null;

  /* Data di creazione della nota. */
  created_at: string;
};

export type CreateCustomerNoteInput = {
  customerId: string;
  conversationId: string;
  messageId: string;
  messageBody: string | null;
  messageCreatedAt: string;
  body: string;
};
