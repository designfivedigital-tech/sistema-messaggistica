-- Note interne dell'azienda su un cliente,
-- create a partire da un messaggio della chat.

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null
    references public.profiles (id) on delete cascade,

  -- Restano valorizzati finché conversazione e
  -- messaggio esistono; la nota sopravvive comunque.
  conversation_id uuid
    references public.conversations (id) on delete set null,
  message_id uuid
    references public.messages (id) on delete set null,

  -- Copia del testo del messaggio annotato.
  message_body text,

  body text not null,

  created_by uuid default auth.uid()
    references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_notes_customer_id_created_at_idx
  on public.customer_notes (customer_id, created_at desc);

alter table public.customer_notes
  enable row level security;

grant select, insert, update, delete
  on public.customer_notes
  to authenticated;

-- Solo gli utenti con ruolo "company" possono
-- leggere e gestire le note.
drop policy if exists "Company manages customer notes"
  on public.customer_notes;

create policy "Company manages customer notes"
  on public.customer_notes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role::text = 'company'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role::text = 'company'
    )
  );
