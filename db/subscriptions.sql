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






-- Create subscriptions table with user_id as TEXT to match users.id type
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,                      -- match users.id type
  hospital_id TEXT,
  plan_key TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  status TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraint (optional, but recommended)
ALTER TABLE subscriptions
  ADD CONSTRAINT fk_subscriptions_user_id
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry_date ON subscriptions(expiry_date);