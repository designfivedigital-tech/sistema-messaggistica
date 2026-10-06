-- Quando il cliente scrive, la conversazione
-- torna tra le "Nuove" finché l'azienda non la
-- prende di nuovo in carico. Vale anche per i
-- messaggi con allegati e per le conversazioni
-- chiuse.

create or replace function public.reopen_conversation_on_customer_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    status = 'new',
    updated_at = now()
  where id = new.conversation_id
    and customer_id = new.sender_id
    and status::text <> 'new';

  return new;
end;
$$;

drop trigger if exists reopen_conversation_on_customer_message
  on public.messages;

create trigger reopen_conversation_on_customer_message
  after insert on public.messages
  for each row
  execute function public.reopen_conversation_on_customer_message();
