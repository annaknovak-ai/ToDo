-- Shared task list (ARCHITECTURE.md 2.3) and access for the app_backend role (ADR-2).
-- Written to be safe to re-run.
-- Requires the app_backend role to exist (created manually once per project).

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title varchar(100),
  description varchar(2000),
  due_date date,
  completed boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- At least one of title/description must contain a non-whitespace character.
  constraint tasks_title_or_description check (title ~ '\S' or description ~ '\S'),
  constraint tasks_position_non_negative check (position >= 0)
);

create index if not exists tasks_position_id_idx on public.tasks (position, id);

-- Only the backend role may access the table; no public Data API access.
revoke all on public.tasks from anon, authenticated;
grant usage on schema public to app_backend;
grant select, insert, update, delete on public.tasks to app_backend;

alter table public.tasks enable row level security;

drop policy if exists tasks_app_backend_all on public.tasks;
create policy tasks_app_backend_all on public.tasks
  for all
  to app_backend
  using (true)
  with check (true);
