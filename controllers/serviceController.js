const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');

const T = 'services';

const DEFAULT_CATEGORIES = [
  'Blood Test',
  'Urine Test',
  'Diagnostic Imaging',
  'Pathology & Biopsy',
  'Preventive Health Checkup',
  'Microbiology & Culture',
  'Cardiac & ECG'
];

const INITIAL_SERVICES = [
  {
    id: 'srv_cbc_01',
    name: 'Complete Blood Count (CBC) Panel',
    category: 'Blood Test',
    description: 'Measures red blood cells, white blood cells, and platelets. Essential for diagnosing anemia, infection, inflammation, and immune disorders in pets.',
    price: 850,
    currency: 'INR',
    duration: '20 mins',
    turnaroundTime: 'Same Day (2-4 Hours)',
    sampleType: 'Blood Sample',
    fastingRequired: false,
    fastingDetails: 'No fasting required, normal hydration recommended.',
    targetSpecies: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Horse', 'All Animals'],
    hospitalIds: [], // Available for all if empty, or assigned
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_urine_01',
    name: 'Comprehensive Urinalysis & Sedimentation',
    category: 'Urine Test',
    description: 'Evaluates chemical properties, crystals, bacteria, and protein levels in pet urine. Helps detect urinary tract infections (UTI), kidney disease, and diabetes.',
    price: 650,
    currency: 'INR',
    duration: '15 mins',
    turnaroundTime: 'Same Day (2 Hours)',
    sampleType: 'Urine Sample',
    fastingRequired: false,
    fastingDetails: 'Fresh morning urine sample preferred or collected at clinic.',
    targetSpecies: ['Dog', 'Cat', 'Rabbit', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_kft_01',
    name: 'Renal & Kidney Function Blood Profile',
    category: 'Blood Test',
    description: 'Measures Blood Urea Nitrogen (BUN), Creatinine, Phosphorus, and SDMA to evaluate kidney filtration and detect early renal insufficiency.',
    price: 1200,
    currency: 'INR',
    duration: '20 mins',
    turnaroundTime: 'Same Day (4 Hours)',
    sampleType: 'Blood Sample',
    fastingRequired: true,
    fastingDetails: '8-12 hours fasting required before sample collection. Water is allowed.',
    targetSpecies: ['Dog', 'Cat', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_lft_01',
    name: 'Liver Function & Hepatic Enzyme Test',
    category: 'Blood Test',
    description: 'Checks ALT, AST, Alkaline Phosphatase (ALP), Total Bilirubin, and Albumin to assess liver health, bile duct status, and toxicity.',
    price: 1350,
    currency: 'INR',
    duration: '20 mins',
    turnaroundTime: 'Same Day (4-6 Hours)',
    sampleType: 'Blood Sample',
    fastingRequired: true,
    fastingDetails: '8-10 hours fasting required. Ensure fresh drinking water is provided.',
    targetSpecies: ['Dog', 'Cat', 'Horse', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_xray_01',
    name: 'High-Resolution Digital X-Ray (2 Views)',
    category: 'Diagnostic Imaging',
    description: 'Orthopedic and thoracic digital radiography for diagnosing bone fractures, lung infections, arthritis, swallowed foreign bodies, and cardiac enlargement.',
    price: 1600,
    currency: 'INR',
    duration: '30 mins',
    turnaroundTime: 'Instant (1 Hour)',
    sampleType: 'X-Ray / Scan',
    fastingRequired: false,
    fastingDetails: 'No fasting needed unless mild sedation is anticipated.',
    targetSpecies: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Horse', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_usg_01',
    name: 'Abdominal & Pelvic Ultrasound Scan',
    category: 'Diagnostic Imaging',
    description: 'Non-invasive real-time sonography examining liver, kidneys, spleen, bladder, stomach, pancreas, and reproductive organs.',
    price: 2200,
    currency: 'INR',
    duration: '35 mins',
    turnaroundTime: 'Same Day (Within 2 Hours)',
    sampleType: 'Ultrasound Scan',
    fastingRequired: true,
    fastingDetails: '10-12 hours fasting required. Avoid allowing pet to urinate 1 hour prior.',
    targetSpecies: ['Dog', 'Cat', 'Rabbit', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_parvo_01',
    name: 'Canine Parvovirus & Giardia Rapid Test',
    category: 'Pathology & Biopsy',
    description: 'Rapid immunoassay detection of Parvovirus antigen and Giardia in puppies and adult dogs showing vomiting or diarrhea.',
    price: 950,
    currency: 'INR',
    duration: '15 mins',
    turnaroundTime: 'Express (15-30 mins)',
    sampleType: 'Fecal / Swab Sample',
    fastingRequired: false,
    fastingDetails: 'Immediate sample testing. No preparation required.',
    targetSpecies: ['Dog'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_felv_01',
    name: 'Feline Leukemia (FeLV) & FIV Combo Test',
    category: 'Blood Test',
    description: 'Crucial screening test for outdoor and rescue cats detecting Feline Leukemia Virus antigen and Feline Immunodeficiency Virus antibodies.',
    price: 1100,
    currency: 'INR',
    duration: '15 mins',
    turnaroundTime: 'Express (30 mins)',
    sampleType: 'Blood Sample',
    fastingRequired: false,
    fastingDetails: 'No fasting needed.',
    targetSpecies: ['Cat'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'srv_wellness_01',
    name: 'Senior Pet Comprehensive Health & Organ Panel',
    category: 'Preventive Health Checkup',
    description: 'All-inclusive blood panel + Urinalysis covering CBC, Glucose, Kidney, Liver, Electrolytes, Thyroid (T4), and cardiac risk assessment.',
    price: 2800,
    currency: 'INR',
    duration: '40 mins',
    turnaroundTime: 'Same Day (6 Hours)',
    sampleType: 'Blood & Urine Sample',
    fastingRequired: true,
    fastingDetails: '10-12 hours overnight fasting required. Fresh water is permitted.',
    targetSpecies: ['Dog', 'Cat', 'All Animals'],
    hospitalIds: [],
    hospitalNames: [],
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80'
  }
];

// Helper: resolve hospital names from IDs
const resolveHospitalNames = async (hospitalIds = []) => {
  if (!Array.isArray(hospitalIds) || hospitalIds.length === 0) return [];
  let hospitals = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('hospitals').select('id, name');
      if (Array.isArray(data)) hospitals = data;
    } catch (e) {}
  }
  if (!hospitals.length) {
    const db = readDB();
    hospitals = db.hospitals || [];
  }
  return hospitalIds.map((id) => {
    const found = hospitals.find((h) => String(h.id) === String(id));
    return found ? found.name : id;
  });
};

// Helper: Ensure initial services seeded in local db if empty
const ensureLocalSeed = () => {
  const db = readDB();
  if (!Array.isArray(db.services) || db.services.length === 0) {
    const hospitals = db.hospitals || [];
    const allHospitalIds = hospitals.map(h => String(h.id));
    const allHospitalNames = hospitals.map(h => h.name);

    const seeded = INITIAL_SERVICES.map(s => ({
      ...s,
      hospitalIds: allHospitalIds.length > 0 ? allHospitalIds : ['all'],
      hospitalNames: allHospitalNames.length > 0 ? allHospitalNames : ['All Accredited Hospitals'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    db.services = seeded;
    writeDB(db);
    return seeded;
  }
  return db.services;
};

// ─── GET /api/services ──────────────────────────────────────────
const getServices = async (req, res) => {
  try {
    const { hospitalId, category, species, search, activeOnly } = req.query || {};

    let list = [];
    if (supabase) {
      try {
        let q = supabase.from(T).select('*').order('createdAt', { ascending: false });
        if (activeOnly === 'true') {
          q = q.eq('isActive', true);
        }
        if (category && category !== 'all') {
          q = q.eq('category', category);
        }
        const { data, error } = await q;
        if (!error && Array.isArray(data) && data.length > 0) {
          list = data;
        }
      } catch (e) {
        console.warn('[services] Supabase getServices failed, fallback to local:', e.message || e);
      }
    }

    if (!list.length) {
      list = ensureLocalSeed();
    }

    // Apply filtering
    if (activeOnly === 'true') {
      list = list.filter((s) => s.isActive !== false);
    }
    if (category && category !== 'all') {
      list = list.filter((s) => (s.category || '').toLowerCase() === category.toLowerCase());
    }
    if (species && species !== 'all') {
      list = list.filter((s) => {
        const spec = s.targetSpecies || [];
        return spec.includes('All Animals') || spec.some(sp => sp.toLowerCase() === species.toLowerCase());
      });
    }
    if (hospitalId && hospitalId !== 'all') {
      list = list.filter((s) => {
        if (!s.hospitalIds || s.hospitalIds.length === 0) return true; // offered by all
        if (s.hospitalIds.includes('all')) return true;
        return s.hospitalIds.map(String).includes(String(hospitalId));
      });
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.category || '').toLowerCase().includes(term) ||
        (s.description || '').toLowerCase().includes(term) ||
        (s.sampleType || '').toLowerCase().includes(term)
      );
    }

    return res.json(list);
  } catch (err) {
    console.error('[services] getServices error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /api/services/:id ──────────────────────────────────────
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    let service = null;

    if (supabase) {
      try {
        const { data, error } = await supabase.from(T).select('*').eq('id', id).single();
        if (!error && data) service = data;
      } catch (e) {}
    }

    if (!service) {
      const db = readDB();
      service = (db.services || []).find((s) => String(s.id) === String(id));
    }

    if (!service) {
      return res.status(404).json({ message: 'Service / Diagnostic Test not found' });
    }

    return res.json(service);
  } catch (err) {
    console.error('[services] getServiceById error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /api/services (SuperAdmin Only) ──────────────────────
const createService = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      price,
      currency,
      duration,
      turnaroundTime,
      sampleType,
      fastingRequired,
      fastingDetails,
      targetSpecies,
      hospitalIds,
      imageUrl,
      isActive
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Service name is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Service category is required' });
    }

    const serviceId = `srv_${Date.now()}`;
    const cleanHospitalIds = Array.isArray(hospitalIds) ? hospitalIds : [];
    const hospitalNames = await resolveHospitalNames(cleanHospitalIds);

    const newService = {
      id: serviceId,
      name: name.trim(),
      category: category.trim(),
      description: description ? description.trim() : '',
      price: price !== undefined && price !== '' ? Number(price) : 0,
      currency: currency || 'INR',
      duration: duration || '30 mins',
      turnaroundTime: turnaroundTime || 'Same Day (2-4 Hours)',
      sampleType: sampleType || 'Blood Sample',
      fastingRequired: Boolean(fastingRequired),
      fastingDetails: fastingDetails ? fastingDetails.trim() : '',
      targetSpecies: Array.isArray(targetSpecies) && targetSpecies.length > 0 ? targetSpecies : ['All Animals'],
      hospitalIds: cleanHospitalIds,
      hospitalNames: hospitalNames.length > 0 ? hospitalNames : ['All Hospitals'],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      imageUrl: imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let inserted = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from(T).insert(newService).select().single();
        if (!error && data) inserted = data;
      } catch (err) {
        console.warn('[services] Supabase insert failed, saving to db.json:', err.message || err);
      }
    }

    // Always update local db.json as backup / active store
    const db = readDB();
    db.services = db.services || [];
    db.services.unshift(inserted || newService);
    writeDB(db);

    return res.status(201).json({
      message: 'Diagnostic service created successfully',
      service: inserted || newService
    });
  } catch (err) {
    console.error('[services] createService error:', err);
    return res.status(500).json({ message: 'Could not create diagnostic service' });
  }
};

// ─── PUT /api/services/:id (SuperAdmin Only) ───────────────────
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    db.services = db.services || [];

    const existingIndex = db.services.findIndex((s) => String(s.id) === String(id));
    const existing = existingIndex !== -1 ? db.services[existingIndex] : null;

    const {
      name,
      category,
      description,
      price,
      currency,
      duration,
      turnaroundTime,
      sampleType,
      fastingRequired,
      fastingDetails,
      targetSpecies,
      hospitalIds,
      imageUrl,
      isActive
    } = req.body || {};

    let hospitalNames = existing?.hospitalNames || [];
    if (hospitalIds !== undefined) {
      hospitalNames = await resolveHospitalNames(hospitalIds);
    }

    const patch = {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(category !== undefined ? { category: category.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(turnaroundTime !== undefined ? { turnaroundTime } : {}),
      ...(sampleType !== undefined ? { sampleType } : {}),
      ...(fastingRequired !== undefined ? { fastingRequired: Boolean(fastingRequired) } : {}),
      ...(fastingDetails !== undefined ? { fastingDetails: fastingDetails.trim() } : {}),
      ...(targetSpecies !== undefined ? { targetSpecies } : {}),
      ...(hospitalIds !== undefined ? { hospitalIds, hospitalNames } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      updatedAt: new Date().toISOString()
    };

    let updated = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
        if (!error && data) updated = data;
      } catch (err) {
        console.warn('[services] Supabase update failed, updating db.json:', err.message || err);
      }
    }

    if (existingIndex !== -1) {
      db.services[existingIndex] = { ...db.services[existingIndex], ...patch };
      writeDB(db);
      if (!updated) updated = db.services[existingIndex];
    }

    if (!updated && !existing) {
      return res.status(404).json({ message: 'Service not found' });
    }

    return res.json({
      message: 'Diagnostic service updated successfully',
      service: updated || { ...existing, ...patch }
    });
  } catch (err) {
    console.error('[services] updateService error:', err);
    return res.status(500).json({ message: 'Could not update diagnostic service' });
  }
};

// ─── DELETE /api/services/:id (SuperAdmin Only) ────────────────
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (supabase) {
      try {
        await supabase.from(T).delete().eq('id', id);
      } catch (e) {}
    }

    const db = readDB();
    db.services = (db.services || []).filter((s) => String(s.id) !== String(id));
    writeDB(db);

    return res.json({ message: 'Diagnostic service deleted successfully' });
  } catch (err) {
    console.error('[services] deleteService error:', err);
    return res.status(500).json({ message: 'Could not delete diagnostic service' });
  }
};

// ─── GET /api/services/categories ──────────────────────────────
const getServiceCategories = async (req, res) => {
  try {
    const db = readDB();
    const existingServices = db.services || [];
    const usedCategories = existingServices.map(s => s.category).filter(Boolean);
    const uniqueCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...usedCategories]));
    return res.json(uniqueCategories);
  } catch (err) {
    return res.json(DEFAULT_CATEGORIES);
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServiceCategories
};
