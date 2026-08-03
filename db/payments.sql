CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  amount INTEGER,
  currency TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'paid', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);