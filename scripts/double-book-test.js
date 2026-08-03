// Verifies two DIFFERENT bookings cannot take the same slot.
require('dotenv').config();
const BASE = 'http://localhost:5000';
const EMAIL = process.env.GMAIL_USER || 'test@example.com';
const ok = (m) => console.log('\x1b[32m✔\x1b[0m', m);
const bad = (m) => console.log('\x1b[31m✖\x1b[0m', m);
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

const login = async () => (await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'superadmin@hospital.com', password: '123' })
}))).token;

const makeInvited = async (auth, name) => {
  const b = (await j(await fetch(`${BASE}/api/demos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hospitalName: name, contactName: name, email: EMAIL })
  }))).booking;
  const inv = (await j(await fetch(`${BASE}/api/demos/${b.id}/invite`, { method: 'POST', headers: auth }))).booking;
  return { id: b.id, token: inv.schedule_token };
};

(async () => {
  let fail = 0;
  const token = await login();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const A = await makeInvited(auth, 'DoubleBook A');
  const B = await makeInvited(auth, 'DoubleBook B');

  // A books the first available slot
  const slotsA = (await j(await fetch(`${BASE}/api/schedule/${A.token}`))).slots;
  const slot = slotsA[0];
  let r = await fetch(`${BASE}/api/schedule/${A.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) });
  r.ok ? ok(`A booked ${new Date(slot).toLocaleString()}`) : (bad('A could not book'), fail++);

  // That slot must NOT appear in B's availability
  const slotsB = (await j(await fetch(`${BASE}/api/schedule/${B.token}`))).slots;
  slotsB.includes(slot) ? (bad('taken slot still shown to B'), fail++) : ok('taken slot hidden from B');

  // B tries the same slot anyway → must be rejected
  r = await fetch(`${BASE}/api/schedule/${B.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) });
  r.status === 409 ? ok(`B rejected with 409 (${(await j(r)).message})`) : (bad(`B expected 409, got ${r.status}`), fail++);

  // Cleanup
  await fetch(`${BASE}/api/demos/${A.id}`, { method: 'DELETE', headers: auth });
  await fetch(`${BASE}/api/demos/${B.id}`, { method: 'DELETE', headers: auth });
  ok('cleaned up');

  console.log(`\n${fail ? '\x1b[31m' : '\x1b[32m'}${fail} failures\x1b[0m`);
  process.exit(fail ? 1 : 0);
})();
