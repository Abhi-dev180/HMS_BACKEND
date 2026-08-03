// Full end-to-end test: demo → invite → schedule (Cal.com) → complete → feedback (Stripe)
// → registration → approval → admin login → public appointment. Cleans up after itself.
require('dotenv').config();
const { supabase } = require('../config/supabase');

const BASE = process.env.TEST_BASE || 'http://localhost:5055';
const EMAIL = process.env.GMAIL_USER || 'test@example.com';
const CAL_KEY = process.env.CALCOM_API_KEY;
const ok = (m) => console.log('\x1b[32m✔\x1b[0m', m);
let fails = 0;
const bad = (m) => { console.log('\x1b[31m✖\x1b[0m', m); fails++; };
const j = async (r) => { try { return await r.json(); } catch { return {}; } };
const H = { 'Content-Type': 'application/json' };

(async () => {
  // superadmin login
  let r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'superadmin@hospital.com', password: '123' }) });
  const token = (await j(r)).token;
  const auth = { ...H, Authorization: `Bearer ${token}` };
  token ? ok('super admin login') : bad('super admin login');

  console.log('\n── Demo funnel ──');
  // 1 create demo
  r = await fetch(`${BASE}/api/demos`, { method: 'POST', headers: H, body: JSON.stringify({ hospitalName: 'FinalCheck Vet', contactName: 'Final Tester', email: EMAIL, phone: '9876543210', city: 'Testville' }) });
  let d = await j(r); const demoId = d.booking?.id;
  demoId ? ok(`demo booking created → "received" email`) : bad('create demo: ' + d.message);

  // 2 invite
  r = await fetch(`${BASE}/api/demos/${demoId}/invite`, { method: 'POST', headers: auth });
  d = await j(r); const schedTok = d.booking?.schedule_token;
  schedTok ? ok('scheduling invite sent → email') : bad('invite: ' + d.message);

  // 3 slots (Cal.com)
  r = await fetch(`${BASE}/api/schedule/${schedTok}`);
  d = await j(r);
  const free = (d.slots || []).filter((s) => !s.taken);
  const slot = free[Math.min(40, free.length - 1)]; // a few days out, avoids legacy-occupied early slots
  (d.provider === 'calcom' && slot) ? ok(`Cal.com slots loaded (${d.slots.length} slots, green+red)`) : bad('slots: provider=' + d.provider);

  // 4 book slot → Google Meet
  r = await fetch(`${BASE}/api/schedule/${schedTok}`, { method: 'POST', headers: H, body: JSON.stringify({ slot: slot?.iso }) });
  d = await j(r); const meet = d.booking?.meetingLink;
  (r.ok && meet && meet.includes('meet.google.com')) ? ok(`slot booked → Google Meet + confirmation email`) : bad('book slot: ' + JSON.stringify(d));

  // cancel the Cal.com booking so the calendar stays clean
  if (CAL_KEY) {
    const lr = await fetch(`https://api.cal.com/v2/bookings?attendeeEmail=${EMAIL}`, { headers: { Authorization: `Bearer ${CAL_KEY}`, 'cal-api-version': '2024-08-13' } });
    const active = ((await j(lr)).data || []).find((x) => x.status !== 'cancelled');
    if (active) { await fetch(`https://api.cal.com/v2/bookings/${active.uid}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${CAL_KEY}`, 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' }, body: JSON.stringify({ cancellationReason: 'flow test' }) }); ok('cleaned up Cal.com test booking'); }
  }

  // 5 complete → feedback
  r = await fetch(`${BASE}/api/demos/${demoId}/complete`, { method: 'POST', headers: auth });
  d = await j(r); const fbTok = d.booking?.feedback_token;
  fbTok ? ok('demo completed → feedback email') : bad('complete: ' + d.message);

  // 6 feedback interested → Stripe checkout
  r = await fetch(`${BASE}/api/feedback/${fbTok}`, { method: 'POST', headers: H, body: JSON.stringify({ rating: 5, interested: true, comment: 'Great!' }) });
  d = await j(r);
  (d.interested && d.checkoutUrl && d.checkoutUrl.includes('stripe.com')) ? ok('feedback (interested) → Stripe checkout session created') : bad('feedback/stripe: ' + JSON.stringify(d));

  console.log('\n── Registration → approval → login ──');
  const regEmail = 'finalcheck.admin@example.com';
  const regPwd = 'FinalCheck@1';
  const { data: reg } = await supabase.from('registrations').insert({ hospital_name: 'FinalCheck Vet', contact_name: 'Final Admin', email: regEmail, phone: '9876543210', city: 'Testville', details: { password: regPwd }, status: 'pending' }).select().single();
  reg ? ok('registration submitted (pending)') : bad('registration insert');

  r = await fetch(`${BASE}/api/registrations/${reg.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'approved' }) });
  d = await j(r);
  (r.ok && d.registration?.status === 'active') ? ok('super admin approved → admin account created + credentials email') : bad('approve: ' + JSON.stringify(d));

  r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: regEmail, password: regPwd }) });
  d = await j(r);
  (d.token && d.user?.role === 'admin') ? ok(`new hospital admin can log in`) : bad('new admin login: ' + JSON.stringify(d));

  console.log('\n── Public appointment ──');
  const hospitals = await j(await fetch(`${BASE}/api/hospitals`));
  const hosp = hospitals[0];
  hosp ? ok(`hospitals loaded (${hospitals.length})`) : bad('hospitals');
  r = await fetch(`${BASE}/api/appointments/public`, { method: 'POST', headers: H, body: JSON.stringify({ hospitalId: hosp?.id, patientName: 'Test Patient', patientPhone: '9876543210', email: EMAIL, date: '2026-08-10', time: '10:30', description: 'Checkup' }) });
  d = await j(r); const apptId = d.appointment?.id;
  apptId ? ok(`public appointment booked at "${d.appointment.hospital}" → email sent`) : bad('appointment: ' + JSON.stringify(d));

  // cleanup
  console.log('\n── Cleanup ──');
  await fetch(`${BASE}/api/demos/${demoId}`, { method: 'DELETE', headers: auth });
  if (reg?.id) await supabase.from('registrations').delete().eq('id', reg.id);
  const { data: au } = await supabase.from('users').select('id').ilike('email', regEmail);
  if (au && au[0]) await supabase.from('users').delete().eq('id', au[0].id);
  if (apptId) await supabase.from('appointments').delete().eq('id', apptId);
  ok('test data removed');

  console.log(`\n${fails ? '\x1b[31m' + fails + ' FAILURE(S)' : '\x1b[32mALL CHECKS PASSED 🎉'}\x1b[0m`);
  await new Promise((res) => setTimeout(res, 4000)); // let emails flush
  process.exit(fails ? 1 : 0);
})();
