

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron'); // <-- added for scheduled jobs
const { runDailyExpiryChecks } = require('./cronJobs'); // <-- your cron logic

const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const contactRoutes = require('./routes/contactRoutes');
const callRoutes = require('./routes/callRoutes');
const demoRoutes = require('./routes/demoRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const demoFeedbackRoutes = require('./routes/demoFeedbackRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const statsRoutes = require('./routes/statsRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const userRoutes = require('./routes/userRoutes');


const app = express();

// ─── CORS Configuration ──────────────────────────────────────
const rawFrontendUrls = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = rawFrontendUrls
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

console.log('🚀 Allowed CORS origins:', allowedOrigins);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (origin.match(/^https?:\/\/[a-zA-Z0-9-]+\.vercel\.app$/)) return true;
  if (origin.startsWith('http://localhost:')) return true;
  return allowedOrigins.includes(origin);
};

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    console.log(`🔍 Incoming origin: "${origin}"`);
    if (isAllowedOrigin(origin)) {
      console.log('✅ Origin allowed');
      return cb(null, true);
    }
    console.warn('❌ Origin not allowed:', origin);
    return cb(null, false);
  },
  credentials: true
}));

// Stripe webhook – must come before express.json()
const { webhook: stripeWebhook } = require('./controllers/paymentController');
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter middleware to prevent exceeding API usage limits
const { apiRateLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiRateLimiter({ windowMs: 60 * 1000, maxRequests: 120 }));

// ─── Request logger ──────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);

app.get('/api/appointments/by-number/:number', async (req, res) => {
  const { number } = req.params;
  const num = Number(number);
  const { data, error } = await require('./config/supabase').supabase
    .from('appointments')
    .select('*')
    .eq('appointment_number', num)
    .maybeSingle();
  if (error || !data) return res.status(404).json({ message: 'Not found' });
  res.json(data);
});

app.use('/api/appointments', appointmentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/demos', demoRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/feedback', demoFeedbackRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/users', userRoutes);

const { submitPublicFeedback } = require('./controllers/publicFeedbackController');
app.post('/api/public-feedback', submitPublicFeedback);


// ─── Appointment feedback routes ─────────────────────────────
const { authMiddleware, roleMiddleware } = require('./middleware/authMiddleware');
const {
  getFeedbacks,
  createFeedback,
  updateFeedback,
  deleteFeedback
} = require('./controllers/appointmentFeedbackController');

const appointmentFeedbackRouter = express.Router();
appointmentFeedbackRouter.get('/', authMiddleware, getFeedbacks);
appointmentFeedbackRouter.post('/', authMiddleware, roleMiddleware(['admin', 'superadmin']), createFeedback);
appointmentFeedbackRouter.put('/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), updateFeedback);
appointmentFeedbackRouter.delete('/:id', authMiddleware, roleMiddleware(['superadmin']), deleteFeedback);

app.use('/api/appointment-feedbacks', appointmentFeedbackRouter);

// ─── Instant email testing endpoint ───────────────────────────
const { sendTestEmail } = require('./services/emailService');
app.get('/api/test-email', async (req, res) => {
  const targetEmail = req.query.to || process.env.GOOGLE_USER || process.env.GMAIL_USER || 'rajdevfree2@gmail.com';
  console.log(`[test-email] Sending test email to: ${targetEmail}`);
  const result = await sendTestEmail(targetEmail);
  return res.json({ message: `Test email attempt to ${targetEmail}`, result });
});

// ─── Renewal token verification ──────────────────────────────
const { supabase } = require('./config/supabase');

app.get('/api/auth/verify-renewal/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('renewal_token', token)
      .gt('renewal_token_expiry', new Date().toISOString())
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        valid: false, 
        message: 'Invalid or expired renewal link' 
      });
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return res.json({
      valid: true,
      user,
      subscription: subscription || null
    });
  } catch (error) {
    console.error('[verify-renewal] error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ─── Manual trigger for expiry checks (admin only) ──────────
// Protect this with a simple token or your auth middleware
app.post('/api/admin/run-expiry-checks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  // You can compare with an environment variable, e.g., process.env.ADMIN_CRON_TOKEN
  if (token !== process.env.ADMIN_CRON_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    await runDailyExpiryChecks();
    res.json({ message: 'Expiry checks completed successfully' });
  } catch (err) {
    console.error('[manual cron] error:', err);
    res.status(500).json({ message: 'Cron job failed' });
  }
});

// ─── Health checks ────────────────────────────────────────────
app.get('/ping', (req, res) => res.json({ pong: true }));
app.get('/', (req, res) => res.json({ message: 'Backend is running' }));

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// ─── Start server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ /api/appointment-feedbacks ready`);
  console.log(`✅ /api/subscriptions ready`);

  // ─── Start the daily cron job (runs at midnight every day) ──
  cron.schedule('0 0 * * *', () => {
    console.log('[cron] Daily expiry check triggered at', new Date().toISOString());
    runDailyExpiryChecks().catch(err => {
      console.error('[cron] Error running expiry checks:', err);
    });
  });

  console.log('⏰ Daily cron job scheduled for 00:00');
});

// Initialize WebSockets
const { initWebSocket } = require('./services/websocketService');
initWebSocket(server);