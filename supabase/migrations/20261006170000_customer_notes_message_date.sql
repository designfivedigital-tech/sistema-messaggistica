-- Data di invio del messaggio annotato, copiata
-- nella nota perché resti disponibile anche se
-- il messaggio viene eliminato.

alter table public.customer_notes
  add column if not exists message_created_at timestamptz;

-- Recupera la data per le note già esistenti.
update public.customer_notes
set message_created_at = messages.created_at
from public.messages
where messages.id = customer_notes.message_id
  and customer_notes.message_created_at is null;
