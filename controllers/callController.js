const { supabase } = require('../config/supabase');

const scoped = (q, req, col = 'hospitalId') => {
  if (req.user.role === 'admin') return q.eq('hospitalId', req.user.hospitalId);
  if (req.user.role !== 'superadmin') return q.eq('userId', req.user.id);
  return q;
};

const createCallLog = async (req, res) => {
  const { hospitalId, patientName, patientPhone, notes } = req.body;
  if (!hospitalId || !patientName || !patientPhone) return res.status(400).json({ message: 'hospitalId, patientName and patientPhone are required' });

  const call = { id: Date.now().toString(), userId: req.user.id, hospitalId, patientName, patientPhone, notes: notes || '', status: 'Completed' };
  const { data: callData, error: cErr } = await supabase.from('calls').insert(call).select().single();
  if (cErr) return res.status(500).json({ message: 'Could not log call' });

  const transcription = { id: (Date.now() + 1).toString(), callId: call.id, hospitalId, userId: req.user.id, patientName, transcript: notes || `Call recorded for ${patientName}` };
  const { data: tData } = await supabase.from('transcriptions').insert(transcription).select().single();

  return res.status(201).json({ message: 'Call logged successfully', call: callData, transcription: tData });
};

const getCallLogs = async (req, res) => {
  const { data, error } = await scoped(supabase.from('calls').select('*').order('createdAt', { ascending: false }), req);
  if (error) return res.status(500).json({ message: 'Could not load calls' });
  return res.json(data || []);
};

const getTranscriptions = async (req, res) => {
  const { data, error } = await scoped(supabase.from('transcriptions').select('*').order('createdAt', { ascending: false }), req);
  if (error) return res.status(500).json({ message: 'Could not load transcriptions' });
  return res.json(data || []);
};

const createTranscription = async (req, res) => {
  const { patientName, transcript } = req.body || {};
  if (!transcript) return res.status(400).json({ message: 'Transcript is required' });
  const row = { id: Date.now().toString(), callId: null, hospitalId: req.user.hospitalId, userId: null, patientName: patientName || '', transcript };
  const { data, error } = await supabase.from('transcriptions').insert(row).select().single();
  if (error) return res.status(500).json({ message: 'Could not add transcription' });
  return res.status(201).json({ message: 'Transcription added', transcription: data });
};

const updateTranscription = async (req, res) => {
  const { id } = req.params;
  const { data: arr } = await supabase.from('transcriptions').select('*').eq('id', id).limit(1);
  const t = arr && arr[0];
  if (!t) return res.status(404).json({ message: 'Transcription not found' });
  if (req.user.role === 'admin' && String(t.hospitalId) !== String(req.user.hospitalId)) return res.status(403).json({ message: 'Forbidden' });

  const { patientName, transcript } = req.body || {};
  const patch = { updatedAt: new Date().toISOString() };
  if (patientName !== undefined) patch.patientName = patientName;
  if (transcript !== undefined) patch.transcript = transcript;
  const { data } = await supabase.from('transcriptions').update(patch).eq('id', id).select().single();
  return res.json({ message: 'Transcription updated', transcription: data });
};

const deleteTranscription = async (req, res) => {
  const { id } = req.params;
  const { data: arr } = await supabase.from('transcriptions').select('*').eq('id', id).limit(1);
  const t = arr && arr[0];
  if (!t) return res.status(404).json({ message: 'Transcription not found' });
  if (req.user.role === 'admin' && String(t.hospitalId) !== String(req.user.hospitalId)) return res.status(403).json({ message: 'Forbidden' });
  await supabase.from('transcriptions').delete().eq('id', id);
  return res.json({ message: 'Transcription deleted' });
};

module.exports = { createCallLog, getCallLogs, getTranscriptions, createTranscription, updateTranscription, deleteTranscription };
