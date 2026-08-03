const { supabase } = require('../config/supabase');
const { sendSubscriptionExpiryReminder, sendSubscriptionExpired } = require('../services/emailService');
const { generateRenewalLink } = require('../controllers/subscriptionController');

async function checkSubscriptions() {
  console.log('[cron] Checking subscription expirations...');

  // Check for subscriptions expiring in 7 days
  const expiring = await getExpiringSubscriptions(7);
  for (const sub of expiring) {
    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', sub.user_id)
      .single();

    if (user) {
      const renewalLink = await generateRenewalLink(sub.user_id);
      await sendSubscriptionExpiryReminder({
        to: user.email,
        contactName: user.name,
        planName: sub.plan_key,
        expiryDate: sub.expiry_date,
        renewalLink
      });
      console.log(`[cron] Reminder sent to ${user.email}`);
    }
  }

  // Check for expired subscriptions
  const expired = await getExpiredSubscriptions();
  for (const sub of expired) {
    // Update status to expired
    await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sub.id);

    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', sub.user_id)
      .single();

    if (user) {
      const renewalLink = await generateRenewalLink(sub.user_id);
      await sendSubscriptionExpired({
        to: user.email,
        contactName: user.name,
        planName: sub.plan_key,
        renewalLink
      });
      console.log(`[cron] Expiration email sent to ${user.email}`);
    }
  }
}

// ─── Helper functions (import from paymentController) ────────
async function getExpiringSubscriptions(daysBefore) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysBefore);

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('expiry_date', cutoff.toISOString())
    .gte('expiry_date', new Date().toISOString());

  if (error) {
    console.error('[cron] getExpiringSubscriptions error:', error);
    return [];
  }
  return data || [];
}

async function getExpiredSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'active')
    .lt('expiry_date', new Date().toISOString());

  if (error) {
    console.error('[cron] getExpiredSubscriptions error:', error);
    return [];
  }
  return data || [];
}

// Run the cron job
checkSubscriptions().catch(console.error);