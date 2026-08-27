const { supabase, isConfigured } = require('../config/supabase');
const { readDB, writeDB } = require('../models');
const {
  sendContactReceived,
  sendContactStatusUpdate,
  sendContactNewToSuperAdmin,
  sendContactReplyEmail
} = require('../services/emailService');
const { uploadAttachmentToCloudinary } = require('../services/cloudinaryService');
const { broadcast } = require('../services/websocketService');

const T = 'contacts';
const STATUSES = ['new', 'in_progress', 'resolved', 'closed'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Row → API shape (camelCase)
const publicView = (r) => ({
  id: String(r.id),
  name: r.name,
  email: r.email,
  phone: r.phone || '',
  subject: r.subject,
  message: r.message,
  source: r.source || (String(r.id).startsWith('gmail_') ? 'support_email' : 'contact_form'),
  status: r.status || 'new',
  feedback: r.feedback || '',
  attachments: r.attachments || [],
  respondedAt: r.responded_at || r.respondedAt || null,
  respondedBy: r.responded_by || r.respondedBy || '',
  createdAt: r.created_at || r.createdAt || new Date().toISOString(),
  updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
  submittedAt: r.created_at || r.createdAt || new Date().toISOString()
});

// Helper for local db.json operations
const getLocalContacts = () => {
  const db = readDB();
  return db.contacts || [];
};

const saveLocalContacts = (contacts) => {
  const db = readDB();
  db.contacts = contacts;
  writeDB(db);
};

// ─── POST /api/contacts  (public inquiry submission) ─────────
const submitContact = async (req, res) => {
  const { name, email, subject, phone, message, attachments } = req.body || {};

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

  // Upload any incoming user attachments to Cloudinary
  const uploadedAttachments = [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      if (att.data || att.url) {
        const uploaded = await uploadAttachmentToCloudinary(att.data || att.url, att.filename || 'user_attachment');
        if (uploaded && uploaded.url) {
          uploadedAttachments.push(uploaded);
        } else {
          uploadedAttachments.push({ filename: att.filename || 'Attachment', url: att.data || att.url || '' });
        }
      }
    }
  }

  const row = {
    id: Date.now().toString(),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    subject: String(subject || '').trim() || 'General Inquiry',
    phone: cleanedPhone,
    message: String(message).trim(),
    source: 'contact_form',
    status: 'new',
    attachments: uploadedAttachments,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let savedRow = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).insert(row).select().single();
      if (!error && data) savedRow = data;
    } catch (e) {}
  }

  if (!savedRow) {
    const contacts = getLocalContacts();
    contacts.unshift(row);
    saveLocalContacts(contacts);
    savedRow = row;
  }

  // Send acknowledgement emails
  sendContactReceived({
    to: savedRow.email,
    name: savedRow.name,
    email: savedRow.email,
    phone: savedRow.phone,
    subject: savedRow.subject,
    message: savedRow.message
  }).catch((e) => console.error('[contacts] acknowledgement email failed:', e));

  sendContactNewToSuperAdmin({
    name: savedRow.name,
    email: savedRow.email,
    phone: savedRow.phone,
    subject: savedRow.subject,
    message: savedRow.message,
    submittedAt: savedRow.created_at
  }).catch((e) => console.error('[contacts] superadmin alert email failed:', e));

  const out = publicView(savedRow);
  broadcast('contact_created', out);

  return res.status(201).json({
    message: 'Thanks! Your message has been sent — check your inbox for a confirmation.',
    contact: out
  });
};

// ─── GET /api/contacts  (superadmin) — list + counts ──────────
const listContacts = async (req, res) => {
  let contactsData = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        contactsData = data;
      }
    } catch (e) {}
  }

  const localContacts = getLocalContacts();

  // Merge Supabase contacts and local db.json contacts without duplicates
  const map = new Map();
  contactsData.forEach((c) => map.set(String(c.id), c));
  localContacts.forEach((c) => {
    if (!map.has(String(c.id))) {
      map.set(String(c.id), c);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => {
    const da = new Date(a.created_at || a.createdAt || 0).getTime();
    const dbTime = new Date(b.created_at || b.createdAt || 0).getTime();
    return dbTime - da;
  });

  const counts = merged.reduce(
    (acc, c) => {
      acc.total += 1;
      const st = c.status || 'new';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    { total: 0, new: 0, in_progress: 0, resolved: 0, closed: 0 }
  );

  return res.json({ contacts: merged.map(publicView), counts });
};

// ─── POST /api/contacts/:id/reply  (superadmin reply with email + Cloudinary attachments)
const replyContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage, status = 'resolved', attachments = [] } = req.body || {};

    if (!replyMessage || !String(replyMessage).trim()) {
      return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    let existing = null;
    if (supabase) {
      try {
        const { data } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
        if (data) existing = data;
      } catch (e) {}
    }

    if (!existing) {
      const contacts = getLocalContacts();
      existing = contacts.find((c) => String(c.id) === String(id));
    }

    if (!existing) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }

    // Process and upload any admin attachments to Cloudinary
    const processedAttachments = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.data || att.url) {
          const uploaded = await uploadAttachmentToCloudinary(att.data || att.url, att.filename || 'admin_attachment');
          if (uploaded && uploaded.url) {
            processedAttachments.push(uploaded);
          } else {
            processedAttachments.push({ filename: att.filename || 'Attachment', url: att.data || att.url || '' });
          }
        }
      }
    }

    const adminName = req.user?.name || req.user?.email || 'Super Admin';
    const existingAttachments = existing.attachments || [];
    const mergedAttachments = [...existingAttachments, ...processedAttachments];

    const patch = {
      status: status || 'resolved',
      feedback: String(replyMessage).trim(),
      attachments: mergedAttachments,
      responded_at: new Date().toISOString(),
      responded_by: adminName,
      updated_at: new Date().toISOString()
    };

    let updatedRow = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
        if (!error && data) updatedRow = data;
      } catch (e) {}
    }

    if (!updatedRow) {
      const contacts = getLocalContacts();
      const idx = contacts.findIndex((c) => String(c.id) === String(id));
      if (idx !== -1) {
        contacts[idx] = { ...contacts[idx], ...patch };
        updatedRow = contacts[idx];
        setTimeout(() => saveLocalContacts(contacts), 100);
      }
    }

    const out = publicView(updatedRow || { ...existing, ...patch });

    // ─── Dispatch attractive HTML email reply to sender ────────
    let emailed = false;
    if (out.email) {
      sendContactReplyEmail({
        to: out.email,
        name: out.name,
        subject: out.subject,
        originalMessage: out.message,
        replyMessage: String(replyMessage).trim(),
        adminName,
        attachments: processedAttachments
      }).catch((err) => console.error('[contacts] sendContactReplyEmail error:', err.message));
      emailed = true;
    }

    broadcast('contact_updated', out);

    return res.json({
      message: emailed ? 'Reply sent! The sender has received an email with attachments.' : 'Reply recorded successfully.',
      emailed,
      contact: out
    });
  } catch (err) {
    console.error('[contacts] replyContact error:', err);
    return res.status(500).json({ message: 'Error processing reply.', error: err.message });
  }
};

// ─── PATCH /api/contacts/:id  (superadmin update status/feedback) ──────
const updateContact = async (req, res) => {
  const { id } = req.params;
  const { status, feedback, notify = true } = req.body || {};

  if (status === undefined && feedback === undefined) {
    return res.status(400).json({ message: 'Provide a status and/or feedback to update.' });
  }

  let existing = null;
  if (supabase) {
    try {
      const { data } = await supabase.from(T).select('*').eq('id', id).maybeSingle();
      if (data) existing = data;
    } catch (e) {}
  }

  if (!existing) {
    const contacts = getLocalContacts();
    existing = contacts.find((c) => String(c.id) === String(id));
  }

  if (!existing) {
    return res.status(404).json({ message: 'Contact message not found.' });
  }

  const patch = { updated_at: new Date().toISOString() };
  if (status !== undefined) patch.status = status;
  if (feedback !== undefined) patch.feedback = String(feedback).trim();

  if ((feedback !== undefined && String(feedback).trim()) || (status && status !== 'new')) {
    patch.responded_at = new Date().toISOString();
    patch.responded_by = req.user?.email || req.user?.name || 'Super Admin';
  }

  let updatedRow = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
      if (!error && data) updatedRow = data;
    } catch (e) {}
  }

  if (!updatedRow) {
    const contacts = getLocalContacts();
    const idx = contacts.findIndex((c) => String(c.id) === String(id));
    if (idx !== -1) {
      contacts[idx] = { ...contacts[idx], ...patch };
      saveLocalContacts(contacts);
      updatedRow = contacts[idx];
    }
  }

  const out = publicView(updatedRow || { ...existing, ...patch });

  let emailed = false;
  if (notify && patch.feedback && out.email) {
    try {
      await sendContactReplyEmail({
        to: out.email,
        name: out.name,
        subject: out.subject,
        originalMessage: out.message,
        replyMessage: patch.feedback,
        adminName: req.user?.name || 'Super Admin'
      });
      emailed = true;
    } catch (e) {
      console.error('[contacts] email failed:', e);
    }
  }

  broadcast('contact_updated', out);
  return res.json({ message: emailed ? 'Updated and emailed sender.' : 'Updated successfully.', emailed, contact: out });
};

// ─── DELETE /api/contacts/:id  (superadmin) ───────────────────
const deleteContact = async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      await supabase.from(T).delete().eq('id', id);
    } catch (e) {}
  }

  const contacts = getLocalContacts();
  const target = contacts.find((c) => String(c.id) === String(id));
  
  const db = readDB();
  db.deleted_contact_ids = db.deleted_contact_ids || [];
  db.deleted_contact_ids.push(String(id));
  if (target && target.email && target.subject) {
    db.deleted_contact_ids.push(`${String(target.email).toLowerCase()}|${String(target.subject).trim()}`);
  }
  db.deleted_contact_ids = Array.from(new Set(db.deleted_contact_ids));

  db.contacts = contacts.filter((c) => String(c.id) !== String(id));
  writeDB(db);

  broadcast('contact_deleted', { id });
  return res.json({ message: 'Message deleted successfully.' });
};

// ─── DELETE /api/contacts/bulk (superadmin) ─────────────────
const bulkDeleteContacts = async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'Array of contact IDs is required for bulk deletion.' });
  }

  const idStrings = ids.map(id => String(id));

  if (supabase) {
    try {
      await supabase.from(T).delete().in('id', idStrings);
    } catch (e) {}
  }

  const contacts = getLocalContacts();
  const targets = contacts.filter((c) => idStrings.includes(String(c.id)));

  const db = readDB();
  db.deleted_contact_ids = db.deleted_contact_ids || [];
  
  idStrings.forEach(id => db.deleted_contact_ids.push(String(id)));
  targets.forEach((c) => {
    if (c.email && c.subject) {
      db.deleted_contact_ids.push(`${String(c.email).toLowerCase()}|${String(c.subject).trim()}`);
    }
  });
  db.deleted_contact_ids = Array.from(new Set(db.deleted_contact_ids));

  db.contacts = contacts.filter((c) => !idStrings.includes(String(c.id)));
  writeDB(db);

  idStrings.forEach((id) => broadcast('contact_deleted', { id }));

  return res.json({ message: `Successfully deleted ${idStrings.length} contact messages.`, count: idStrings.length });
};

module.exports = {
  submitContact,
  listContacts,
  replyContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts
};
