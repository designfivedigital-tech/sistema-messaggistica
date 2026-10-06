-- Un cliente può cambiare solo la propria
-- immagine profilo: nome e sito web sono
-- gestiti dall'azienda. Sostituisce la versione
-- precedente, che bloccava soltanto il nome.

create or replace function public.prevent_customer_name_change()
returns trigger
language plpgsql
as $$
begin
  if old.role::text = 'customer'
    and (select auth.uid()) = old.id
    and (
      new.display_name is distinct from old.display_name
      or new.website_url is distinct from old.website_url
    )
  then
    raise exception
      'Nome e sito web possono essere modificati solo dall''azienda';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_customer_name_change
  on public.profiles;

create trigger prevent_customer_name_change
  before update on public.profiles
  for each row
  execute function public.prevent_customer_name_change();
