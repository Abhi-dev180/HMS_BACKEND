// Users data access (Supabase). Shared by auth, hospital, and registration controllers.
const { supabase } = require('../config/supabase');

const T = 'users';

const findByEmail = async (email) => {
  const e = String(email || '').trim();
  if (!e || !supabase) return null;
  const { data, error } = await supabase.from(T).select('*').ilike('email', e).limit(1);
  if (error) throw error; // surface network/DB errors instead of looking like "not found"
  return (data && data[0]) || null;
};

const findById = async (id) => {
  if (!supabase) return null;
  const { data } = await supabase.from(T).select('*').eq('id', id).limit(1);
  return (data && data[0]) || null;
};

const all = async (filters = {}) => {
  if (!supabase) return [];
  let q = supabase.from(T).select('*');
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data } = await q.order('createdAt', { ascending: true });
  return data || [];
};

const insert = async (user) => {
  if (!supabase) throw new Error('Database is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  const { data, error } = await supabase.from(T).insert(user).select().single();
  if (error) throw error;
  return data;
};

const update = async (id, patch) => {
  if (!supabase) throw new Error('Database is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

const remove = async (id) => {
  if (!supabase) throw new Error('Database is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  const { error } = await supabase.from(T).delete().eq('id', id);
  if (error) throw error;
};

module.exports = { findByEmail, findById, all, insert, update, remove };
