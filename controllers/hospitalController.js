const { supabase, isConfigured } = require('../config/supabase');
const Users = require('../db/users');

const T = 'hospitals';

const notConfigured = (res) =>
  res.status(503).json({ message: 'Hospital database storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env file.' });

const getHospitals = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { data, error } = await supabase.from(T).select('*').order('createdAt', { ascending: false });
  if (error) { console.error('[hospitals] list:', error); return res.status(500).json({ message: 'Could not load hospitals' }); }
  return res.json(data || []);
};

const getHospitalById = async (req, res) => {
  if (!isConfigured()) return notConfigured(res);
  const { data } = await supabase.from(T).select('*').eq('id', req.params.id).limit(1);
  const hospital = data && data[0];
  if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
  return res.json(hospital);
};

const createHospital = async (req, res) => {
    console.log('>>> createHospital called with name:', req.body.name); 
  const { name, location, icu, careType, specialty, beds, contact, videoUrl, imageUrl, adminName, adminEmail, adminPassword, timings, emergency } = req.body;
  if (!name || !location) return res.status(400).json({ message: 'Hospital name and location are required' });

  // 1. Check for duplicate hospital by name 
  const { data: existingHospital, error: nameCheckError } = await supabase
    .from(T)
    .select('id, name')
    .ilike('name', name.trim())
    .limit(1);

  if (nameCheckError) {
    console.error('[hospitals] duplicate name check error:', nameCheckError);
    return res.status(500).json({ message: 'Unable to verify hospital name uniqueness. Please try again.' });
  }

  if (existingHospital && existingHospital.length > 0) {
    return res.status(409).json({
      message: `Hospital "${name}" already exists. Please use a different name or update the existing hospital.`,
      existingHospital: existingHospital[0]
    });
  }

  // 2. Optional: Check for duplicate location 
  const { data: existingLocation, error: locationCheckError } = await supabase
    .from(T)
    .select('id, name, location')
    .eq('location', location.trim())
    .limit(1);

  if (locationCheckError) {
    console.error('[hospitals] duplicate location check error:', locationCheckError);
    return res.status(500).json({ message: 'Unable to verify location uniqueness. Please try again.' });
  }

  if (existingLocation && existingLocation.length > 0) {
    return res.status(409).json({
      message: `A hospital already exists at this location: "${existingLocation[0].name}". Please use a different location.`,
      existingHospital: existingLocation[0]
    });
  }

  // No duplicates – proceed with creation
  const hospitalId = Date.now().toString();
  const newHospital = {
    id: hospitalId, name, location,
    icu: icu || '24/7 ICU', careType: careType || 'Advanced Care', specialty: specialty || 'Super Specialty',
    beds: beds || '300+', contact: contact || '+91 91225-56789', videoUrl: videoUrl || '',
    email: adminEmail || '', timings: timings || 'Mon - Sat • 8:00 AM - 8:00 PM', emergency: emergency || '24/7 Emergency Available'
  };
  if (imageUrl) newHospital.imageUrl = imageUrl;

  let { data: inserted, error } = await supabase.from(T).insert(newHospital).select().single();
  // If the imageUrl column hasn't been added yet, save the hospital without the image.
  if (error && error.code === 'PGRST204' && 'imageUrl' in newHospital) {
    console.warn('[hospitals] imageUrl column missing — saving without image');
    const { imageUrl, ...rest } = newHospital;
    ({ data: inserted, error } = await supabase.from(T).insert(rest).select().single());
  }
  if (error) {
    console.error('[hospitals] create:', error);
    return res.status(500).json({ message: 'Could not create hospital' });
  }

  // Optional admin login
  let createdAdmin = null;
  if (adminEmail) {
    const password = (adminPassword && String(adminPassword).trim()) ? String(adminPassword).trim() : Math.random().toString(36).slice(-10);
    const existing = await Users.findByEmail(adminEmail);
    if (existing) createdAdmin = await Users.update(existing.id, { hospital: name, hospitalId });
    else createdAdmin = await Users.insert({ id: (Date.now() + 1).toString(), name: adminName || `${name} Admin`, email: adminEmail, password, role: 'admin', hospital: name, hospitalId, active: true });
  }

  return res.status(201).json({ success: true, message: 'Hospital created successfully', hospital: inserted, admin: createdAdmin });
};

const updateHospital = async (req, res) => {
  const { id } = req.params;
  const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
  const existing = arr && arr[0];
  if (!existing) return res.status(404).json({ message: 'Hospital not found' });

  // Duplicate checks for name/location when updating (excluding current hospital)
  if (req.body.name && req.body.name !== existing.name) {
    const { data: duplicateName, error: nameError } = await supabase
      .from(T)
      .select('id, name')
      .ilike('name', req.body.name.trim())
      .neq('id', id)
      .limit(1);
    if (nameError) return res.status(500).json({ message: 'Error checking name uniqueness' });
    if (duplicateName && duplicateName.length > 0) {
      return res.status(409).json({ message: `Another hospital already exists with the name "${req.body.name}".` });
    }
  }

  if (req.body.location && req.body.location !== existing.location) {
    const { data: duplicateLocation, error: locError } = await supabase
      .from(T)
      .select('id, name, location')
      .eq('location', req.body.location.trim())
      .neq('id', id)
      .limit(1);
    if (locError) return res.status(500).json({ message: 'Error checking location uniqueness' });
    if (duplicateLocation && duplicateLocation.length > 0) {
      return res.status(409).json({ message: `Another hospital already exists at this location: "${duplicateLocation[0].name}".` });
    }
  }

  const { adminName, adminEmail, adminPassword, id: _ignore, ...hospitalUpdates } = req.body;
  const patch = { ...hospitalUpdates, ...(adminEmail ? { email: adminEmail } : {}) };
  if (!patch.imageUrl) delete patch.imageUrl;

  let { data: updated, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
  if (error && error.code === 'PGRST204' && 'imageUrl' in patch) {
    const { imageUrl, ...rest } = patch;
    ({ data: updated, error } = await supabase.from(T).update(rest).eq('id', id).select().single());
  }
  if (error) { console.error('[hospitals] update:', error); return res.status(500).json({ message: 'Could not update hospital' }); }

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
  const { data: arr } = await supabase.from(T).select('*').eq('id', req.user.hospitalId).limit(1);
  const h = arr && arr[0];
  if (!h) return res.status(404).json({ message: 'Hospital not found for this admin' });
  const { data: updated } = await supabase.from(T).update({
    timings: timings || h.timings || 'Mon - Sat • 8:00 AM - 8:00 PM',
    emergency: emergency || h.emergency || '24/7 Emergency Available'
  }).eq('id', h.id).select().single();
  return res.json({ message: 'Hospital timings updated successfully', hospital: updated });
};

const deleteHospital = async (req, res) => {
  const { id } = req.params;
  const { data: arr } = await supabase.from(T).select('*').eq('id', id).limit(1);
  const removed = arr && arr[0];
  if (!removed) return res.status(404).json({ message: 'Hospital not found' });
  await supabase.from(T).delete().eq('id', id);
  const admins = await Users.all({ role: 'admin', hospitalId: id });
  if (admins[0]) await Users.remove(admins[0].id);
  return res.json({ message: 'Hospital deleted', hospital: removed });
};

module.exports = { getHospitals, getHospitalById, createHospital, updateHospital, updateOwnHospitalTimings, deleteHospital };