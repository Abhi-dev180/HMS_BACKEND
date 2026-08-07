// scripts/addSuperAdmin.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { supabase } = require('../config/supabase');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Generate a random user ID (matching your system's pattern)
 * Your existing users have IDs like '1786006844761', '1', '2', etc.
 * We'll generate a timestamp-based ID for uniqueness.
 */
const generateUserId = () => {
  return String(Date.now() + Math.floor(Math.random() * 1000));
};

/**
 * Main function – prompts for details and inserts the superadmin
 */
async function addSuperAdmin() {
  console.log('\n🚀 Add a Super Admin user to the system\n');

  // ─── Get user input ──────────────────────────────────────────
  const name = await question('Full Name: ');
  if (!name.trim()) {
    console.error('❌ Name is required.');
    process.exit(1);
  }

  const email = await question('Email: ');
  if (!email.trim() || !email.includes('@')) {
    console.error('❌ Valid email is required.');
    process.exit(1);
  }

  const password = await question('Password (min 6 chars): ');
  if (password.length < 6) {
    console.error('❌ Password must be at least 6 characters.');
    process.exit(1);
  }

  // ─── Check if user already exists ───────────────────────────
  console.log(`\n🔍 Checking if ${email} already exists...`);
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (checkError) {
    console.error('❌ Error checking existing user:', checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.error(`❌ User with email ${email} already exists (ID: ${existing.id}).`);
    console.log('Please use a different email or update the existing user.');
    process.exit(1);
  }

  // ─── Build user object ──────────────────────────────────────
  const userId = generateUserId();
  const now = new Date().toISOString();

  const newUser = {
    id: userId,
    name: name.trim(),
    email: email.trim(),
    password: password.trim(), // ⚠️ Stored in plain text (as per your current system)
    role: 'superadmin',
    active: true,
    createdAt: now,
    // optional fields:
    mobile: null,
    hospital: null,
    hospitalId: null,
    plan_key: null,
    plan_start: null,
    plan_end: null,
    plan_status: null,
    resetOtp: null,
    resetOtpExpires: null
  };

  // ─── Insert into Supabase ──────────────────────────────────
  console.log(`\n📝 Inserting superadmin "${name}" (${email})...`);
  const { data, error } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to insert superadmin:', error.message);
    console.error('Details:', error.details || '');
    process.exit(1);
  }

  console.log('\n✅ Super Admin added successfully!');
  console.log(`🆔 ID: ${data.id}`);
  console.log(`👤 Name: ${data.name}`);
  console.log(`📧 Email: ${data.email}`);
  console.log(`🔑 Role: ${data.role}`);
  console.log('\nYou can now log in with these credentials.');
  rl.close();
}

// ─── Run the script ──────────────────────────────────────────
addSuperAdmin().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});