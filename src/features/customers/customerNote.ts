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

  /*
   * Timer Clockify collegato alla nota. I campi
   * restano nulli per le note senza timer.
   */
  operator_name: string | null;
  clockify_time_entry_id: string | null;
  clockify_project_id: string | null;
  timer_started_at: string | null;
  timer_stopped_at: string | null;
  duration_seconds: number | null;
};

export type CreateCustomerNoteInput = {
  customerId: string;
  conversationId: string;
  messageId: string;
  messageBody: string | null;
  messageCreatedAt: string;
  body: string;
};

export function isNoteTimerRunning(
  note: CustomerNote,
): boolean {
  return (
    note.clockify_time_entry_id !== null &&
    note.timer_stopped_at === null
  );
}
