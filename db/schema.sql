-- Pet Hospital Portal — funnel schema (run in the Supabase SQL editor)
-- Safe to re-run: everything is idempotent (if-not-exists / drop-add).

create extension if not exists "pgcrypto";

-- ── demo_bookings ──────────────────────────────────────────────────────
create table if not exists public.demo_bookings (
  id                 uuid primary key default gen_random_uuid(),
  hospital_name      text        not null,
  contact_name       text        not null,
  email              text        not null,
  phone              text,
  city               text,
  message            text,
  status             text        not null default 'requested',
  scheduled_at       timestamptz,
  meeting_link       text,
  calendly_event_uri text,
  schedule_token     text,
  feedback_token     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- statuses (Phase 2 adds 'invited' = superadmin asked the prospect to pick a time)
alter table public.demo_bookings drop constraint if exists demo_bookings_status_check;
alter table public.demo_bookings add constraint demo_bookings_status_check
  check (status in ('requested','invited','scheduled','completed','cancelled'));

alter table public.demo_bookings add column if not exists schedule_token text;
alter table public.demo_bookings add column if not exists feedback_token text;

create index if not exists demo_bookings_status_idx     on public.demo_bookings (status);
create index if not exists demo_bookings_created_at_idx on public.demo_bookings (created_at desc);
create unique index if not exists demo_bookings_schedule_token_idx
  on public.demo_bookings (schedule_token) where schedule_token is not null;
create unique index if not exists demo_bookings_feedback_token_idx
  on public.demo_bookings (feedback_token) where feedback_token is not null;

-- Hard guarantee: no two demos scheduled for the same instant.
create unique index if not exists demo_bookings_slot_unique
  on public.demo_bookings (scheduled_at)
  where status = 'scheduled' and scheduled_at is not null;

-- ── demo_feedback ──────────────────────────────────────────────────────
create table if not exists public.demo_feedback (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.demo_bookings(id) on delete cascade,
  rating       int  check (rating between 1 and 5),
  interested   boolean not null default false,
  comment      text,
  created_at   timestamptz not null default now()
);
create index if not exists demo_feedback_booking_idx on public.demo_feedback (booking_id);

-- ── registrations ──────────────────────────────────────────────────────
create table if not exists public.registrations (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references public.demo_bookings(id) on delete set null,
  username        text unique,
  hospital_name   text not null,
  contact_name    text not null,
  email           text not null,
  phone           text,
  city            text,
  address         text,
  beds            int,
  details         jsonb,
  status          text not null default 'pending'
                    check (status in ('pending','approved','denied','active','inactive')),
  admin_user_id   text,           -- id of the admin created in the HMS users store
  hospital_id     text,           -- HMS hospital assigned by the admin
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists registrations_status_idx  on public.registrations (status);
create index if not exists registrations_booking_idx on public.registrations (booking_id);

-- ── payments ───────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid references public.demo_bookings(id) on delete set null,
  email              text,
  stripe_session_id  text unique,
  amount             int,
  currency           text default 'usd',
  status             text not null default 'pending'
                       check (status in ('pending','paid','failed')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists payments_session_idx on public.payments (stripe_session_id);
create index if not exists payments_booking_idx on public.payments (booking_id);

-- The backend uses the service-role key, which bypasses RLS. Keep RLS off (or fully
-- locked with no anon policies) because all access is server-side.
