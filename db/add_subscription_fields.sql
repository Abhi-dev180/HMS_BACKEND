-- Add subscription summary fields to users and plan_key to payments

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS plan_key text;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS plan_start timestamptz;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS plan_end timestamptz;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS plan_status text;

-- Add plan_key to payments for one-time checkout bookkeeping
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS plan_key text;

-- Indexes to help queries by plan and dates
CREATE INDEX IF NOT EXISTS users_plan_key_idx ON public.users (plan_key);
CREATE INDEX IF NOT EXISTS users_plan_start_idx ON public.users (plan_start);
CREATE INDEX IF NOT EXISTS payments_plan_key_idx ON public.payments (plan_key);




-- Add appointment_number (4‑digit numeric) to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number INTEGER;

-- Add appointment_id foreign key to appointment_feedbacks
ALTER TABLE appointment_feedbacks ADD COLUMN IF NOT EXISTS appointment_id TEXT;

-- Optional: add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_number ON appointments (appointment_number);