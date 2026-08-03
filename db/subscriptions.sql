CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,           -- Reference to the user who purchased
  hospital_id TEXT,                -- Associated hospital
  plan_key TEXT NOT NULL,          -- 'mini', 'basic', 'advanced'
  plan_type TEXT NOT NULL,         -- 'monthly', 'quarterly', 'yearly'
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription ID
  stripe_customer_id TEXT,         -- Stripe customer ID
  status TEXT DEFAULT 'active',    -- 'active', 'expired', 'cancelled', 'past_due'
  start_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  amount INTEGER NOT NULL,         -- Amount in cents
  currency TEXT DEFAULT 'usd',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expiry_date ON subscriptions(expiry_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);