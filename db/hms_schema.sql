-- Pet Hospital Portal — core HMS tables (migrated off db.json).
-- Run this in the Supabase SQL editor. Safe to re-run (if-not-exists).
-- Columns are camelCase (quoted) to match the app objects 1:1.

-- ── users ──────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                text primary key,
  name              text,
  email             text unique,
  mobile            text,
  password          text,
  role              text,
  hospital          text,
  "hospitalId"      text,
  active            boolean default true,
  "resetOtp"        text,
  "resetOtpExpires" bigint,
  "createdAt"       timestamptz default now()
);
create index if not exists users_email_idx on public.users (lower(email));
create index if not exists users_role_idx  on public.users (role);

-- ── hospitals ──────────────────────────────────────────────────────────
create table if not exists public.hospitals (
  id           text primary key,
  name         text,
  location     text,
  icu          text,
  "careType"   text,
  specialty    text,
  beds         text,
  contact      text,
  "videoUrl"   text,
  email        text,
  timings      text,
  emergency    text,
  "imageUrl"   text,
  "createdAt"  timestamptz default now()
);
alter table public.hospitals add column if not exists "imageUrl" text;

-- ── appointments ───────────────────────────────────────────────────────
create table if not exists public.appointments (
  id                text primary key,
  "userId"          text,
  "hospitalId"      text,
  hospital          text,
  "doctorName"      text,
  date              text,
  time              text,
  "patientName"     text,
  "patientPhone"    text,
  email             text,
  reason            text,
  "petName"         text,
  species           text,
  "appointmentType" text,
  status            text default 'Pending',
  source            text,
  "createdAt"       timestamptz default now(),
  "updatedAt"       timestamptz
);
create index if not exists appointments_hospital_idx on public.appointments ("hospitalId");
create index if not exists appointments_user_idx     on public.appointments ("userId");

-- ── feedbacks (HMS patient feedback; distinct from the funnel demo_feedback) ──
create table if not exists public.feedbacks (
  id            text primary key,
  "userId"      text,
  "userName"    text,
  "hospitalId"  text,
  rating        int,
  message       text,
  status        text default 'Published',
  "createdAt"   timestamptz default now(),
  "updatedAt"   timestamptz
);
create index if not exists feedbacks_hospital_idx on public.feedbacks ("hospitalId");

-- ── calls ──────────────────────────────────────────────────────────────
create table if not exists public.calls (
  id             text primary key,
  "userId"       text,
  "hospitalId"   text,
  "patientName"  text,
  "patientPhone" text,
  notes          text,
  status         text default 'Completed',
  "createdAt"    timestamptz default now()
);
create index if not exists calls_hospital_idx on public.calls ("hospitalId");

-- ── transcriptions ─────────────────────────────────────────────────────
create table if not exists public.transcriptions (
  id             text primary key,
  "callId"       text,
  "hospitalId"   text,
  "userId"       text,
  "patientName"  text,
  transcript     text,
  "createdAt"    timestamptz default now(),
  "updatedAt"    timestamptz
);
create index if not exists transcriptions_hospital_idx on public.transcriptions ("hospitalId");

-- All access is server-side via the service-role key, which bypasses RLS.
