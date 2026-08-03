// End-to-end funnel smoke test against a RUNNING server (http://localhost:5000).
// Usage:  node scripts/smoke-test.js
require('dotenv').config();

const BASE = 'http://localhost:5000';
const EMAIL = process.env.GMAIL_USER || 'test@example.com'; // send test emails to yourself
const ok = (m) => console.log('\x1b[32m✔\x1b[0m', m);
const bad = (m) => console.log('\x1b[31m✖\x1b[0m', m);

const j = async (res) => { try { return await res.json(); } catch { return {}; } };

(async () => {
  let fail = 0;

  // 1. Public: create a demo booking
  let r = await fetch(`${BASE}/api/demos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hospitalName: 'Smoke Test Vet', contactName: 'Smoke Tester', email: EMAIL, phone: '9876543210', city: 'Testville' })
  });
  let d = await j(r);
  const id = d.booking?.id;
  if (r.ok && id) ok(`created booking ${id} (→ "received" email to ${EMAIL})`); else { bad(`create booking: ${d.message}`); fail++; }

  // 2. Superadmin login
  r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@hospital.com', password: '123' })
  });
  d = await j(r);
  const token = d.token;
  if (token) ok('superadmin login'); else { bad(`login: ${d.message}`); fail++; }
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 3. Superadmin: list demos
  r = await fetch(`${BASE}/api/demos`, { headers: auth });
  d = await j(r);
  if (r.ok) ok(`list demos: total=${d.counts?.total}`); else { bad(`list: ${d.message}`); fail++; }

  // 4. Superadmin: invite to schedule
  r = await fetch(`${BASE}/api/demos/${id}/invite`, { method: 'POST', headers: auth });
  d = await j(r);
  const scheduleToken = d.booking?.schedule_token;
  if (r.ok && scheduleToken) ok(`invite sent (→ "pick a time" email)`); else { bad(`invite: ${d.message}`); fail++; }

  // 5. Public: get available slots
  r = await fetch(`${BASE}/api/schedule/${scheduleToken}`);
  d = await j(r);
  const slot = d.slots?.[0];
  if (r.ok && slot) ok(`got ${d.slots.length} slots, first = ${new Date(slot).toLocaleString()}`); else { bad(`slots: ${d.message}`); fail++; }

  // 6. Public: book the first slot
  r = await fetch(`${BASE}/api/schedule/${scheduleToken}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot })
  });
  d = await j(r);
  if (r.ok) ok(`booked slot (→ "confirmed" email, meeting: ${d.booking?.meetingLink?.slice(0, 40)}…)`); else { bad(`book: ${d.message}`); fail++; }

  // 7. Double-book guard: try the SAME slot again (expect 409)
  r = await fetch(`${BASE}/api/schedule/${scheduleToken}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot })
  });
  if (r.status === 409) ok('double-book correctly rejected (409)'); else { bad(`double-book guard: expected 409, got ${r.status}`); fail++; }

  // 8. Superadmin: complete → feedback email
  r = await fetch(`${BASE}/api/demos/${id}/complete`, { method: 'POST', headers: auth });
  d = await j(r);
  if (r.ok) ok('marked completed (→ feedback email)'); else { bad(`complete: ${d.message}`); fail++; }

  // 9. Cleanup the test booking
  r = await fetch(`${BASE}/api/demos/${id}`, { method: 'DELETE', headers: auth });
  if (r.ok) ok('cleaned up test booking'); else bad('cleanup failed (delete it manually in Supabase)');

  console.log(`\n${fail ? '\x1b[31m' : '\x1b[32m'}${fail} failures\x1b[0m — waiting 6s for emails to flush…`);
  await new Promise((res) => setTimeout(res, 6000));
  process.exit(fail ? 1 : 0);
})();
