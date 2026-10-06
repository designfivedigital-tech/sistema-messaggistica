-- Tipologia di cliente assegnata dall'azienda.
-- I valori ammessi sono definiti nel frontend in
-- src/features/customers/customerCategory.ts

create table if not exists public.customer_categories (
  customer_id uuid primary key
    references public.profiles (id) on delete cascade,
  category text not null,
  updated_at timestamptz not null default now()
);

alter table public.customer_categories
  enable row level security;

grant select, insert, update, delete
  on public.customer_categories
  to authenticated;

-- Solo gli utenti con ruolo "company" possono
-- leggere e modificare le categorie.
drop policy if exists "Company manages customer categories"
  on public.customer_categories;

create policy "Company manages customer categories"
  on public.customer_categories
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
