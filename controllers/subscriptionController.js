
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

    const successPath = req.body.successPath || '/dashboard';
    const cancelPath = req.body.cancelPath || '/pricing';

    // Fetch latest demo booking for the user
    let bookingDetails = null;
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
    if (user && user.email) {
      const { data: latestBooking } = await supabase
        .from('demo_bookings')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestBooking) {
        bookingDetails = latestBooking;
      }
    }

    const session = await stripeSvc.createSubscriptionCheckout({
      userId,
      hospitalId,
      planKey,
      successPath,
      cancelPath,
      booking: bookingDetails
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

    let subscription = null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data[0]) {
          subscription = data[0];
        }
      } catch (e) {}
    }

    if (!subscription) {
      const { readDB } = require('../models');
      const db = readDB();
      subscription = (db.subscriptions || []).find((s) => String(s.user_id) === String(userId)) || null;
    }

    return res.json({ subscription });
  } catch (error) {
    console.error('[subscription] get error:', error);
    return res.status(500).json({ message: 'Could not fetch subscription' });
  }
};

// ─── Get user's full subscription history ──────────────────────
const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    if (!userId && !userEmail) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let subscriptions = [];
    if (supabase) {
      try {
        let q = supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
        if (userId) {
          q = q.eq('user_id', userId);
        } else if (userEmail) {
          q = q.eq('email', userEmail);
        }
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          subscriptions = data;
        }
      } catch (e) {}
    }

    const { readDB } = require('../models');
    const db = readDB();
    const localSubs = (db.subscriptions || []).filter(
      (s) => (userId && String(s.user_id) === String(userId)) || (userEmail && String(s.email) === String(userEmail))
    );

    // Merge Supabase and local DB subscriptions without duplicates
    const subMap = new Map();
    subscriptions.forEach((s) => subMap.set(String(s.id || s.stripe_subscription_id), s));
    localSubs.forEach((s) => {
      const key = String(s.id || s.stripe_subscription_id);
      if (!subMap.has(key)) subMap.set(key, s);
    });

    const allSubs = Array.from(subMap.values()).sort((a, b) => {
      const da = new Date(a.start_date || a.created_at || 0).getTime();
      const dbTime = new Date(b.start_date || b.created_at || 0).getTime();
      return dbTime - da;
    });

    const activeSub = allSubs.find((s) => s.status === 'active') || allSubs[0] || null;

    return res.json({
      subscription: activeSub,
      subscriptions: allSubs
    });
  } catch (error) {
    console.error('[subscription] getMySubscriptions error:', error);
    return res.status(500).json({ message: 'Could not fetch subscription history' });
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
  getMySubscriptions,
  cancelSubscription,
  generateRenewalLink
};