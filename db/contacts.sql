-- Contact-us submissions (run in the Supabase SQL editor).
-- Safe to re-run: everything is idempotent.

create extension if not exists "pgcrypto";

create table if not exists public.contacts (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  email          text        not null,
  phone          text,
  subject        text        not null default 'General Inquiry',
  message        text        not null,

  -- Superadmin workflow
  status         text        not null default 'new',
  feedback       text,
  responded_at   timestamptz,
  responded_by   text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.contacts add column if not exists phone        text;
alter table public.contacts add column if not exists feedback     text;
alter table public.contacts add column if not exists responded_at timestamptz;
alter table public.contacts add column if not exists responded_by text;

alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts add constraint contacts_status_check
  check (status in ('new','in_progress','resolved','closed'));

create index if not exists contacts_status_idx     on public.contacts (status);
create index if not exists contacts_created_at_idx on public.contacts (created_at desc);
create index if not exists contacts_email_idx      on public.contacts (lower(email));

-- Service-role only: the API is the sole writer/reader.
alter table public.contacts enable row level security;
