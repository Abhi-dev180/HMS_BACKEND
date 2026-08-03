// One-time migration: copy existing db.json data into Supabase.
// Run AFTER creating the tables (db/hms_schema.sql) in the Supabase SQL editor:
//   node scripts/migrate-to-supabase.js
// Safe to re-run — it upserts on id.
require('dotenv').config();
const { supabase, isConfigured } = require('../config/supabase');
const { readDB } = require('../models');

const COLS = {
  users: ['id', 'name', 'email', 'mobile', 'password', 'role', 'hospital', 'hospitalId', 'active', 'resetOtp', 'resetOtpExpires', 'createdAt'],
  hospitals: ['id', 'name', 'location', 'icu', 'careType', 'specialty', 'beds', 'contact', 'videoUrl', 'email', 'timings', 'emergency', 'createdAt'],
  appointments: ['id', 'userId', 'hospitalId', 'hospital', 'doctorName', 'date', 'time', 'patientName', 'patientPhone', 'email', 'reason', 'petName', 'species', 'appointmentType', 'status', 'source', 'createdAt', 'updatedAt'],
  feedbacks: ['id', 'userId', 'userName', 'hospitalId', 'rating', 'message', 'status', 'createdAt', 'updatedAt'],
  calls: ['id', 'userId', 'hospitalId', 'patientName', 'patientPhone', 'notes', 'status', 'createdAt'],
  transcriptions: ['id', 'callId', 'hospitalId', 'userId', 'patientName', 'transcript', 'createdAt', 'updatedAt']
};

const pick = (obj, cols) => {
  const o = { id: String(obj.id) };
  for (const c of cols) if (c !== 'id' && obj[c] !== undefined) o[c] = obj[c];
  return o;
};

(async () => {
  if (!isConfigured()) { console.error('✖ Supabase not configured (.env)'); process.exit(1); }
  const db = readDB();

  for (const table of Object.keys(COLS)) {
    const rows = db[table] || [];
    if (!rows.length) { console.log(`• ${table}: 0 rows, skipped`); continue; }
    const clean = rows.map((r) => pick(r, COLS[table]));
    const { error } = await supabase.from(table).upsert(clean, { onConflict: 'id' });
    if (error) console.error(`✖ ${table}: ${error.message}`);
    else console.log(`✔ ${table}: ${clean.length} rows migrated`);
  }
  console.log('\nDone.');
  process.exit(0);
})();
