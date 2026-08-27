const { supabase, isConfigured } = require('../config/supabase');
const Users = require('../db/users');
const { readDB, writeDB } = require('../models');

const T = 'hospitals';

const getHospitals = async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').order('createdAt', { ascending: false });
      if (!error && Array.isArray(data)) return res.json(data);
    } catch (err) {
      console.warn('[hospitals] list failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  return res.json(db.hospitals || []);
};

const getHospitalById = async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').eq('id', id).limit(1);
      if (!error && Array.isArray(data) && data[0]) return res.json(data[0]);
    } catch (err) {
      console.warn('[hospitals] getById failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  const hospital = (db.hospitals || []).find((h) => String(h.id) === String(id));
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  return res.json(hospital);
};

const createHospital = async (req, res) => {
  console.log('>>> createHospital called with name:', req.body.name);
  const { name, location, icu, careType, specialty, beds, contact, videoUrl, imageUrl, adminName, adminEmail, adminPassword, timings, emergency } = req.body;
  if (!name || !location) return res.status(400).json({ message: 'Hospital name and location are required' });

  let inserted = null;

  if (supabase) {
    try {
      const { data: existingHospital } = await supabase.from(T).select('id, name').ilike('name', name.trim()).limit(1);
      if (existingHospital && existingHospital.length > 0) {
        return res.status(409).json({ message: `Hospital "${name}" already exists.`, existingHospital: existingHospital[0] });
      }

      const hospitalId = Date.now().toString();
      const newHospital = {
        id: hospitalId, name, location,
        icu: icu || '24/7 ICU', careType: careType || 'Advanced Care', specialty: specialty || 'Super Specialty',
        beds: beds || '300+', contact: contact || '+91 91225-56789', videoUrl: videoUrl || '',
        email: adminEmail || '', timings: timings || 'Mon - Sat • 8:00 AM - 8:00 PM', emergency: emergency || '24/7 Emergency Available'
      };
      if (imageUrl) newHospital.imageUrl = imageUrl;

      const resInsert = await supabase.from(T).insert(newHospital).select().single();
      if (!resInsert.error && resInsert.data) {
        inserted = resInsert.data;
      }
    } catch (err) {
      if (!isNetErr(err)) return res.status(500).json({ message: 'Could not create hospital' });
    }
  }

  if (!inserted) {
    const db = readDB();
    db.hospitals = db.hospitals || [];
    const dupe = db.hospitals.find((h) => (h.name || '').toLowerCase() === name.trim().toLowerCase());
    if (dupe) {
      return res.status(409).json({ message: `Hospital "${name}" already exists.`, existingHospital: dupe });
    }
    const hospitalId = Date.now().toString();
    inserted = {
      id: hospitalId, name, location,
      icu: icu || '24/7 ICU', careType: careType || 'Advanced Care', specialty: specialty || 'Super Specialty',
      beds: beds || '300+', contact: contact || '+91 91225-56789', videoUrl: videoUrl || '',
      email: adminEmail || '', timings: timings || 'Mon - Sat • 8:00 AM - 8:00 PM', emergency: emergency || '24/7 Emergency Available',
      ...(imageUrl ? { imageUrl } : {})
    };
    db.hospitals.unshift(inserted);
    writeDB(db);
  }

  let createdAdmin = null;
  if (adminEmail) {
    const password = (adminPassword && String(adminPassword).trim()) ? String(adminPassword).trim() : Math.random().toString(36).slice(-10);
    const existing = await Users.findByEmail(adminEmail);
    if (existing) createdAdmin = await Users.update(existing.id, { hospital: name, hospitalId: inserted.id });
    else createdAdmin = await Users.insert({ id: (Date.now() + 1).toString(), name: adminName || `${name} Admin`, email: adminEmail, password, role: 'admin', hospital: name, hospitalId: inserted.id, active: true });
  }

  return res.status(201).json({ success: true, message: 'Hospital created successfully', hospital: inserted, admin: createdAdmin });
};

const updateHospital = async (req, res) => {
  const { id } = req.params;
  let existing = null;

  if (supabase) {
    try {
      const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
      existing = arr && arr[0];
    } catch (e) {}
  }

  const db = readDB();
  if (!existing) {
    existing = (db.hospitals || []).find((h) => String(h.id) === String(id));
  }

  if (!existing) return res.status(404).json({ message: 'Hospital not found' });

  const { adminName, adminEmail, adminPassword, id: _ignore, ...hospitalUpdates } = req.body;
  const patch = { ...hospitalUpdates, ...(adminEmail ? { email: adminEmail } : {}) };
  if (!patch.imageUrl) delete patch.imageUrl;

  let updated = null;
  if (supabase) {
    try {
      const resUpd = await supabase.from(T).update(patch).eq('id', id).select().single();
      if (!resUpd.error && resUpd.data) updated = resUpd.data;
    } catch (e) {}
  }

  if (!updated) {
    const idx = (db.hospitals || []).findIndex((h) => String(h.id) === String(id));
    if (idx !== -1) {
      db.hospitals[idx] = { ...db.hospitals[idx], ...patch };
      writeDB(db);
      updated = db.hospitals[idx];
    }
  }

  const admins = await Users.all({ role: 'admin', hospitalId: id });
  if (admins[0]) {
    const ap = { hospital: updated.name, hospitalId: updated.id };
    if (adminName) ap.name = adminName;
    if (adminEmail) ap.email = adminEmail;
    if (adminPassword) ap.password = adminPassword;
    await Users.update(admins[0].id, ap);
  }
  return res.json(updated);
};

const updateOwnHospitalTimings = async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only hospital admin can update timings' });
  const { timings, emergency } = req.body;
  let h = null;
  if (supabase) {
    try {
      const { data: arr } = await supabase.from(T).select('*').eq('id', req.user.hospitalId).limit(1);
      h = arr && arr[0];
    } catch (e) {}
  }
  const db = readDB();
  if (!h) {
    h = (db.hospitals || []).find((x) => String(x.id) === String(req.user.hospitalId));
  }
  if (!h) return res.status(404).json({ message: 'Hospital not found for this admin' });

  const patch = {
    timings: timings || h.timings || 'Mon - Sat • 8:00 AM - 8:00 PM',
    emergency: emergency || h.emergency || '24/7 Emergency Available'
  };

  let updated = null;
  if (supabase) {
    try {
      const resUpd = await supabase.from(T).update(patch).eq('id', h.id).select().single();
      if (!resUpd.error && resUpd.data) updated = resUpd.data;
    } catch (e) {}
  }
  if (!updated) {
    const idx = (db.hospitals || []).findIndex((x) => String(x.id) === String(h.id));
    if (idx !== -1) {
      db.hospitals[idx] = { ...db.hospitals[idx], ...patch };
      writeDB(db);
      updated = db.hospitals[idx];
    }
  }
  return res.json({ message: 'Hospital timings updated successfully', hospital: updated });
};

const deleteHospital = async (req, res) => {
  const { id } = req.params;
  let removed = null;

  if (supabase) {
    try {
      const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
      removed = arr && arr[0];
      if (removed) await supabase.from(T).delete().eq('id', id);
    } catch (e) {}
  }

  const db = readDB();
  if (!removed) {
    removed = (db.hospitals || []).find((h) => String(h.id) === String(id));
  }
  if (removed) {
    db.hospitals = (db.hospitals || []).filter((h) => String(h.id) !== String(id));
    writeDB(db);
  } else {
    return res.status(404).json({ message: 'Hospital not found' });
  }

  const admins = await Users.all({ role: 'admin', hospitalId: id });
  if (admins[0]) await Users.remove(admins[0].id);
  return res.json({ message: 'Hospital deleted', hospital: removed });
};

module.exports = { getHospitals, getHospitalById, createHospital, updateHospital, updateOwnHospitalTimings, deleteHospital };