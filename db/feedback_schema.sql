CREATE TABLE IF NOT EXISTS appointment_feedbacks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patientName TEXT NOT NULL,
  petName TEXT,
  appointmentType TEXT DEFAULT 'Consult',
  date TEXT,
  time TEXT,
  feedbackStatus TEXT DEFAULT 'Pending',
  feedbackGiven BOOLEAN DEFAULT false,
  callAttempted BOOLEAN DEFAULT false,
  callPicked BOOLEAN DEFAULT false,
  feedbackText TEXT,
  hospitalId TEXT,
  createdBy TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS details JSONB;
