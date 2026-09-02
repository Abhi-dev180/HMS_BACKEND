-- Diagnostic & Lab Test Services for Animals
-- Run this in Supabase SQL editor if using Supabase directly.

CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Blood Test', 'Urine Test', 'Diagnostic Imaging', 'Pathology & Biopsy', 'Preventive Health', 'General'
  description TEXT,
  price NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  duration TEXT DEFAULT '30 mins',
  "turnaroundTime" TEXT DEFAULT 'Same Day (4-6 Hours)',
  "sampleType" TEXT DEFAULT 'Blood Sample', -- 'Blood Sample', 'Urine Sample', 'Stool Sample', 'Swab', 'X-Ray / Scan', 'Physical Exam'
  "fastingRequired" BOOLEAN DEFAULT false,
  "fastingDetails" TEXT DEFAULT '', -- e.g. '8-12 hours fasting required before test'
  "targetSpecies" TEXT[] DEFAULT ARRAY['Dog', 'Cat', 'All Animals'],
  "hospitalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hospitalNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN DEFAULT true,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_category_idx ON public.services (category);
CREATE INDEX IF NOT EXISTS services_active_idx ON public.services ("isActive");
