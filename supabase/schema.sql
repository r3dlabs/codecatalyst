-- Single table shared by the UI and the simulated design tool.
create table if not exists public.projects (
  id          text primary key,
  context     jsonb       not null default '{}'::jsonb,
  revision    integer     not null default 0,
  snapshot    jsonb,
  diff        jsonb       not null default '{"from_revision":0,"added":[],"removed":[],"changed":[]}'::jsonb,
  event_ids   jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.projects enable row level security;
-- No policies: only the server (service role) reads and writes.

-- Raw uploads before normalisation. Drafts never reach users until a named person checks them.
create table if not exists public.source_drafts (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  issuer      text        not null default 'BCA',
  url         text,
  filename    text,
  excerpt     text,
  candidates  jsonb       not null default '[]'::jsonb,
  status      text        not null default 'uploaded', -- uploaded | drafted | checked
  checked_by  text,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.source_drafts enable row level security;

-- Design-change history and per-control review tracking (not a compliance status).
alter table public.projects add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists reviews jsonb not null default '{}'::jsonb;
