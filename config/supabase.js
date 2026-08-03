const { createClient } = require('@supabase/supabase-js');

// Service-role client for the Supabase-backed app data.
// Degrades gracefully: if env keys are missing we export `null` so the server still boots
// and routes return a clear 503 instead of crashing.

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Retry transient network failures (helps flaky / IPv6-NAT networks reach Supabase).
const fetchWithRetry = async (input, init, retries = 2) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
};

let supabase = null;

if (url && serviceKey) {
  supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithRetry }
  });
} else {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — endpoints will return 503 until configured.'
  );
}

const isConfigured = () => supabase !== null;

module.exports = { supabase, isConfigured };
