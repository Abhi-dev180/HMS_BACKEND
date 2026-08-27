// Users data access (Supabase with db.json fallback). Shared by auth, hospital, and registration controllers.
const { supabase } = require('../config/supabase');
const { readDB, writeDB } = require('../models');

const T = 'users';

const findByEmail = async (email) => {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').ilike('email', e).limit(1);
      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch (err) {
      console.warn('[users] Supabase findByEmail failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  const found = (db.users || []).find((u) => String(u.email || '').trim().toLowerCase() === e);
  return found || null;
};

const findById = async (id) => {
  if (!id) return null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).select('*').eq('id', id).limit(1);
      if (!error && Array.isArray(data) && data[0]) return data[0];
    } catch (err) {
      console.warn('[users] Supabase findById failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  return (db.users || []).find((u) => String(u.id) === String(id)) || null;
};

const all = async (filters = {}) => {
  if (supabase) {
    try {
      let q = supabase.from(T).select('*');
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      const { data, error } = await q.order('createdAt', { ascending: true });
      if (!error && Array.isArray(data)) return data;
    } catch (err) {
      console.warn('[users] Supabase all failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  let list = db.users || [];
  for (const [k, v] of Object.entries(filters)) {
    list = list.filter((u) => String(u[k]) === String(v));
  }
  return list;
};

const insert = async (user) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).insert(user).select().single();
      if (!error && data) return data;
    } catch (err) {
      console.warn('[users] Supabase insert failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  db.users = db.users || [];
  db.users.push(user);
  writeDB(db);
  return user;
};

const update = async (id, patch) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from(T).update(patch).eq('id', id).select().single();
      if (!error && data) return data;
    } catch (err) {
      console.warn('[users] Supabase update failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  db.users = db.users || [];
  const idx = db.users.findIndex((u) => String(u.id) === String(id));
  if (idx !== -1) {
    db.users[idx] = { ...db.users[idx], ...patch };
    writeDB(db);
    return db.users[idx];
  }
  return null;
};

const remove = async (id) => {
  if (supabase) {
    try {
      const { error } = await supabase.from(T).delete().eq('id', id);
      if (!error) return;
    } catch (err) {
      console.warn('[users] Supabase remove failed, using db.json:', err.message || err);
    }
  }
  const db = readDB();
  db.users = (db.users || []).filter((u) => String(u.id) !== String(id));
  writeDB(db);
};

module.exports = { findByEmail, findById, all, insert, update, remove };
