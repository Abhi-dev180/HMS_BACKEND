const { supabase, isConfigured } = require('../config/supabase');
const {
  sendContactReceived,
  sendContactStatusUpdate,
  sendContactNewToSuperAdmin
} = require('../services/emailService');

const T = 'contacts';
const STATUSES = ['new', 'in_progress', 'resolved', 'closed'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const notConfigured = (res) =>
  res.status(503).json({ message: 'Contact storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });

// PostgREST reports an un-migrated table as PGRST205. Say so plainly instead of
// "try again", which sends people hunting for a network problem that isn't there.
const isMissingTable = (error) =>
  error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '');

const tableMissing = (res) => {
  console.error(
    "[contacts] The 'contacts' table does not exist. " +
    'Run HMS_BACKEND/db/contacts.sql in the Supabase SQL editor.'
  );
  return res.status(503).json({
    message:
      'The contact form is not set up yet — the "contacts" table is missing. ' +
      'Run HMS_BACKEND/db/contacts.sql in the Supabase SQL editor, then try again.'
  });
};

// Row → API shape (camelCase, same convention as the other controllers).
const publicView = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone || '',
  subject: r.subject,
  message: r.message,
  status: r.status,
  feedback: r.feedback || '',
  respondedAt: r.responded_at,
  respondedBy: r.responded_by || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  // kept so older frontend code reading `submittedAt` keeps working
  submittedAt: r.created_at
});

// ─── POST /api/contacts  (public) ─────────────────────────────
const submitContact = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);

  const { name, email, subject, phone, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email and message are required.' });
  }
  if (!EMAIL_REGEX.test(String(email).trim())) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  const cleanedPhone = String(phone || '').replace(/\D/g, '');
  if (cleanedPhone && cleanedPhone.length !== 10) {
    return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
  }

  const row = {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    subject: String(subject || '').trim() || 'General Inquiry',
    phone: cleanedPhone,
    message: String(message).trim(),
    status: 'new'
  };

  const { data, error } = await supabase.from(T).insert(row).select().single();
  if (error) {
    console.error('[contacts] submit error:', error);
    if (isMissingTable(error)) return tableMissing(res);
    return res.status(500).json({ message: 'Could not submit your message. Please try again.' });
  }

  // ─── Acknowledgement to the sender ──────────────────────────
  sendContactReceived({
    to: data.email,
    name: data.name,
    email: data.email,
    phone: data.phone,
    subject: data.subject,
    message: data.message
  }).catch((e) => console.error('[contacts] acknowledgement email failed:', e));

  // ─── Alert the superadmin ───────────────────────────────────
  sendContactNewToSuperAdmin({
    name: data.name,
    email: data.email,
    phone: data.phone,
    subject: data.subject,
    message: data.message,
    submittedAt: data.created_at
  }).catch((e) => console.error('[contacts] superadmin alert email failed:', e));

  return res.status(201).json({
    message: 'Thanks! Your message has been sent — check your inbox for a confirmation.',
    contact: publicView(data)
  });
};

// ─── GET /api/contacts  (superadmin) — list + counts ──────────
const listContacts = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);

  const { data, error } = await supabase.from(T).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('[contacts] list error:', error);
    if (isMissingTable(error)) return tableMissing(res);
    return res.status(500).json({ message: 'Could not load contact messages' });
  }

  const counts = (data || []).reduce(
    (acc, c) => {
      acc.total += 1;
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    { total: 0, new: 0, in_progress: 0, resolved: 0, closed: 0 }
  );

  return res.json({ contacts: (data || []).map(publicView), counts });
};

// ─── PATCH /api/contacts/:id  (superadmin) ────────────────────
// Updates status and/or feedback, then emails the sender.
const updateContact = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);

  const { id } = req.params;
  const { status, feedback, notify = true } = req.body || {};

  if (status === undefined && feedback === undefined) {
    return res.status(400).json({ message: 'Provide a status and/or feedback to update.' });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  const { data: existing, error: fetchError } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
  if (fetchError) {
    console.error('[contacts] fetch error:', fetchError);
    if (isMissingTable(fetchError)) return tableMissing(res);
    return res.status(500).json({ message: 'Could not load the contact message' });
  }
  if (!existing) return res.status(404).json({ message: 'Contact message not found' });

  const patch = { updated_at: new Date().toISOString() };
  if (status !== undefined) patch.status = status;
  if (feedback !== undefined) patch.feedback = String(feedback).trim();

  // Stamp who responded the first time feedback is added or the status moves off "new".
  const isResponding = (feedback !== undefined && String(feedback).trim()) || (status && status !== 'new');
  if (isResponding) {
    patch.responded_at = new Date().toISOString();
    patch.responded_by = req.user?.email || req.user?.name || 'superadmin';
  }

  const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
  if (error) {
    console.error('[contacts] update error:', error);
    return res.status(500).json({ message: 'Could not update the contact message' });
  }

  // ─── Notify the sender about the status / feedback ──────────
  const statusChanged = patch.status !== undefined && patch.status !== existing.status;
  const feedbackChanged = patch.feedback !== undefined && patch.feedback !== (existing.feedback || '');

  let emailed = false;
  if (notify && (statusChanged || feedbackChanged) && data.email) {
    emailed = true;
    sendContactStatusUpdate({
      to: data.email,
      name: data.name,
      subject: data.subject,
      message: data.message,
      status: data.status,
      feedback: data.feedback
    }).catch((e) => console.error('[contacts] status update email failed:', e));
  }

  return res.json({
    message: emailed ? 'Contact updated — the sender has been emailed.' : 'Contact updated.',
    emailed,
    contact: publicView(data)
  });
};

// ─── DELETE /api/contacts/:id  (superadmin) ───────────────────
const deleteContact = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);

  const { id } = req.params;
  const { data: existing } = await supabase.from(T).select('id').eq('id', id).maybeSingle();
  if (!existing) return res.status(404).json({ message: 'Contact message not found' });

  const { error } = await supabase.from(T).delete().eq('id', id);
  if (error) {
    console.error('[contacts] delete error:', error);
    return res.status(500).json({ message: 'Could not delete the contact message' });
  }
  return res.json({ message: 'Contact message deleted' });
};

module.exports = { submitContact, listContacts, updateContact, deleteContact, STATUSES };
