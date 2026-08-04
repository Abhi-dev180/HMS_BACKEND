// backend/cronJobs.js
const { supabase } = require('./config/supabase');
const { getExpiringSubscriptions, getExpiredSubscriptions, annotateUserWithSubscription } = require('./controllers/paymentController');
const { generateRenewalLink } = require('./controllers/subscriptionController');
const { sendSubscriptionExpiryReminder, sendSubscriptionExpired } = require('./services/emailService');

/**
 * Daily job:
 * 1. Send reminders to users whose subscription expires in 7, 3, or 1 day.
 * 2. Mark expired subscriptions as 'expired' and update user plan_status.
 */
const runDailyExpiryChecks = async () => {
  console.log('[cron] Running daily expiry checks...');

  // --- Send reminders for upcoming expirations ---
  const days = [7, 3, 1];
  for (const d of days) {
    const expiring = await getExpiringSubscriptions(d);
    for (const sub of expiring) {
      try {
        // Fetch user email
        const { data: user } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', sub.user_id)
          .single();
        if (user) {
          const renewalLink = await generateRenewalLink(sub.user_id);
          await sendSubscriptionExpiryReminder({
            to: user.email,
            name: user.name || 'User',
            daysLeft: d,
            expiryDate: sub.expiry_date,
            renewalLink
          });
          console.log(`[cron] Reminder sent to ${user.email} (${d} days left)`);
        }
      } catch (err) {
        console.error(`[cron] Failed to send reminder for subscription ${sub.id}:`, err);
      }
    }
  }

  // --- Mark expired subscriptions ---
  const expired = await getExpiredSubscriptions(); // returns active subscriptions with expiry_date < now()
  for (const sub of expired) {
    try {
      // Update subscription status
      await supabase
        .from('subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', sub.id);

      // Update user plan_status
      await annotateUserWithSubscription({
        userId: sub.user_id,
        planKey: sub.plan_key,
        startDate: sub.start_date,
        expiryDate: sub.expiry_date,
        status: 'expired'
      });

      // Send expiration email
      const { data: user } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', sub.user_id)
        .single();
      if (user) {
        const renewalLink = await generateRenewalLink(sub.user_id);
        await sendSubscriptionExpired({
          to: user.email,
          name: user.name || 'User',
          expiryDate: sub.expiry_date,
          renewalLink
        });
        console.log(`[cron] Expiration email sent to ${user.email}`);
      }
    } catch (err) {
      console.error(`[cron] Failed to process expired subscription ${sub.id}:`, err);
    }
  }

  console.log('[cron] Daily expiry checks completed.');
};

// If you want to run this as a standalone script, uncomment:
// runDailyExpiryChecks().then(() => process.exit(0));

module.exports = { runDailyExpiryChecks };