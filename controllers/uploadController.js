const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const BUCKET = 'hospital-images';

// POST /api/uploads — multipart "image" field → Supabase Storage → returns public URL
const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false
  });
  if (error) {
    console.error('[upload]', error);
    return res.status(500).json({ message: 'Upload failed' });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return res.status(201).json({ url: data.publicUrl });
};

module.exports = { uploadImage };
