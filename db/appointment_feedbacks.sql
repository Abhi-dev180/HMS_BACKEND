-- Add all missing columns for appointment_feedbacks
ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "feedbackStatus" TEXT DEFAULT 'Pending';

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "feedbackGiven" BOOLEAN DEFAULT false;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "callAttempted" BOOLEAN DEFAULT false;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "callPicked" BOOLEAN DEFAULT false;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "rating" INTEGER;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "appointmentType" TEXT DEFAULT 'Consult';

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "time" TEXT;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "feedbackText" TEXT;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "patientName" TEXT;

ALTER TABLE appointment_feedbacks 
ADD COLUMN IF NOT EXISTS "petName" TEXT;



ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
