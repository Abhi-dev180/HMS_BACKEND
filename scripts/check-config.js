// Health check for the funnel's external services.
// Run:  node scripts/check-config.js
require('dotenv').config();

const ok = (m) => console.log('\x1b[32m✔\x1b[0m', m);
const bad = (m) => console.log('\x1b[31m�’\x1b[0m'.replace('’', '✖'), m);
const info = (m) => console.log('  ', m);

(async () => {
  let pass = 0, fail = 0;

  // 1. Supabase — read the funnel tables
  console.log('\n── Supabase ─────────────────────────────');
  try {
    const { supabase, isConfigured } = require('../config/supabase');
    if (!isConfigured()) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY missing');
    for (const t of ['demo_bookings', 'demo_feedback', 'registrations', 'payments']) {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) { bad(`table "${t}" — ${error.message}`); fail++; }
      else { ok(`table "${t}" reachable (${count} rows)`); pass++; }
    }
  } catch (e) { bad(e.message); fail++; }

  // 2. Gmail (Nodemailer) — verify SMTP login
  console.log('\n── Gmail / Nodemailer ───────────────────');
  try {
    const nodemailer = require('nodemailer');
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing');
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    await t.verify();
    ok(`SMTP login works for ${process.env.GMAIL_USER}`); pass++;
  } catch (e) { bad(`SMTP verify failed — ${e.message}`); info('Check 2-Step Verification is on and the App Password has no spaces.'); fail++; }

  // 3. Stripe — validate the secret key
  console.log('\n── Stripe ───────────────────────────────');
  try {
    const stripeSvc = require('../services/stripeService');
    if (!stripeSvc.isConfigured()) throw new Error('STRIPE_SECRET_KEY missing/placeholder');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const bal = await stripe.balance.retrieve();
    ok(`secret key valid (livemode=${bal.livemode})`); pass++;
    ok(stripeSvc.webhookConfigured() ? 'webhook secret set' : 'webhook secret not set (optional)');
  } catch (e) { bad(`Stripe key check failed — ${e.message}`); fail++; }

  console.log(`\n─────────────────────────────────────────\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
