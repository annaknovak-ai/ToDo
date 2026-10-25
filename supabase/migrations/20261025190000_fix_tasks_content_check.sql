-- The original check let a row with both title and description NULL through,
-- because NULL OR NULL is NULL (and a NULL check result passes). Treat NULL as empty.
alter table public.tasks drop constraint if exists tasks_title_or_description;
alter table public.tasks add constraint tasks_title_or_description
  check (coalesce(title ~ '\S', false) or coalesce(description ~ '\S', false));
