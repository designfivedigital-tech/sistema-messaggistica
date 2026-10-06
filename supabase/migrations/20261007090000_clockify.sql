-- Integrazione Clockify: operatori, abbinamento
-- cliente -> progetto e timer collegati alle note.

-- Operatori Clockify con la loro chiave API.
-- RLS attivo senza policy e nessun grant: la
-- tabella è accessibile solo dalla edge function
-- "clockify", mai direttamente dal browser.
create table if not exists public.clockify_operators (
  id uuid primary key default gen_random_uuid(),
  clockify_user_id text not null unique,
  name text not null,
  email text,
  workspace_id text not null,
  api_key text not null,
  created_at timestamptz not null default now()
);

alter table public.clockify_operators
  enable row level security;

revoke all on public.clockify_operators
  from anon, authenticated;

-- Progetto Clockify abbinato a ciascun cliente.
create table if not exists public.customer_clockify_projects (
  customer_id uuid primary key
    references public.profiles (id) on delete cascade,
  project_id text not null,
  project_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.customer_clockify_projects
  enable row level security;

grant select, insert, update, delete
  on public.customer_clockify_projects
  to authenticated;

drop policy if exists "Company manages clockify projects"
  on public.customer_clockify_projects;

create policy "Company manages clockify projects"
  on public.customer_clockify_projects
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

-- Dati del timer salvati sulla nota.
alter table public.customer_notes
  add column if not exists operator_name text,
  add column if not exists clockify_user_id text,
  add column if not exists clockify_time_entry_id text,
  add column if not exists clockify_project_id text,
  add column if not exists timer_started_at timestamptz,
  add column if not exists timer_stopped_at timestamptz,
  add column if not exists duration_seconds integer;
