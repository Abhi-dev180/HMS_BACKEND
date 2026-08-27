const { createClient } = require('@supabase/supabase-js');

// Service-role client for the Supabase-backed app data.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Retry transient network failures (fails fast on permanent DNS ENOTFOUND).
const fetchWithRetry = async (input, init, retries = 1) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (err?.cause?.code === 'ENOTFOUND' || err?.code === 'ENOTFOUND' || /ENOTFOUND/i.test(String(err))) {
        throw err;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
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
