-- Il nome di un cliente può essere modificato
-- solo dall'azienda, non dal cliente stesso.
-- Il blocco nell'app non basta: questo trigger
-- lo applica anche a chi chiama direttamente
-- le API.

create or replace function public.prevent_customer_name_change()
returns trigger
language plpgsql
as $$
begin
  if new.display_name is distinct from old.display_name
    and old.role::text = 'customer'
    and (select auth.uid()) = old.id
  then
    raise exception
      'Il nome può essere modificato solo dall''azienda';
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
