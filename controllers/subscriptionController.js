
const { supabase } = require('../config/supabase');
const stripeSvc = require('../services/stripeService');
const { sendSubscriptionExpiryReminder, sendSubscriptionExpired } = require('../services/emailService');

// ─── Create subscription checkout ────────────────────────────
const createSubscription = async (req, res) => {
  try {
    const { planKey, hospitalId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!planKey) {
      return res.status(400).json({ message: 'planKey is required' });
    }

    // Allow caller to override the success/cancel redirect paths (used when
    // subscribing as part of a registration funnel to land back on /register).
    const successPath = req.body.successPath || '/dashboard';
    const cancelPath = req.body.cancelPath || '/pricing';

    const session = await stripeSvc.createSubscriptionCheckout({
      userId,
      hospitalId,
      planKey,
      successPath,
      cancelPath
    });

    // Save payment intent to track
    await supabase.from('payments').insert({
      user_id: userId,
      stripe_session_id: session.id,
      amount: 0, // Will be updated from webhook
      currency: 'usd',
      status: 'pending'
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[subscription] create error:', error);
    return res.status(500).json({ message: error.message || 'Could not create subscription' });
  }
};

// ─── Get user's current subscription ─────────────────────────
const getMySubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    return res.json({ subscription: data?.[0] || null });
  } catch (error) {
    console.error('[subscription] get error:', error);
    return res.status(500).json({ message: 'Could not fetch subscription' });
  }
};

// ─── Cancel subscription ──────────────────────────────────────
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    await stripeSvc.cancelSubscription(subscription.stripe_subscription_id);

    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // 🆕 Update the user row
    const { annotateUserWithSubscription } = require('../controllers/paymentController');
    await annotateUserWithSubscription({
      userId,
      planKey: subscription.plan_key,
      startDate: subscription.start_date,
      expiryDate: subscription.expiry_date,
      status: 'cancelled'
    });

    return res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('[subscription] cancel error:', error);
    return res.status(500).json({ message: 'Could not cancel subscription' });
  }
};

// ─── Generate renewal link for a user ────────────────────────
const generateRenewalLink = async (userId) => {
  const token = require('crypto').randomBytes(32).toString('hex');

  await supabase
    .from('users')
    .update({ renewal_token: token, renewal_token_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', userId);

  const baseUrl = process.env.FRONTEND_REDIRECT_URL || 'https://hospital-management-sigma-six.vercel.app';
  return `${baseUrl}/renew/${token}`;
};

module.exports = {
  createSubscription,
  getMySubscription,
  cancelSubscription,
  generateRenewalLink
};