const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n❌ ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in backend/.env!');
  console.log('Please ensure these are set first before running this script.\n');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n================================================================');
  console.log('🔑 Google OAuth Refresh Token Generator');
  console.log('================================================================');

  // Let them choose the redirect URI that is already configured in Google Cloud Console
  console.log('\nGoogle OAuth requires a redirect URI that matches your Google Cloud Console configuration.');
  console.log('Common defaults:');
  console.log('  1) http://localhost:5173/oauth2callback  (Recommended / Frontend)');
  console.log('  2) http://localhost:3000/oauth2callback');
  
  const choice = await askQuestion('\nSelect redirect URI option [1] or enter a custom one: ');
  let redirectUri = 'http://localhost:5173/oauth2callback';
  if (choice.trim() !== '1' && choice.trim() !== '') {
    if (choice.trim() === '2') {
      redirectUri = 'http://localhost:3000/oauth2callback';
    } else {
      redirectUri = choice.trim();
    }
  }

  console.log(`Using redirect URI: \x1b[33m${redirectUri}\x1b[0m`);

  // Scopes required for both Gmail API (email sending) and Google Calendar API (Google Meet links)
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent' // Forces consent screen to ensure refresh token is returned
    }).toString();

  console.log('\n👉 1. Open the following URL in your browser to authorize:');
  console.log(`\n\x1b[34m${authUrl}\x1b[0m\n`);

  console.log('👉 2. After authorizing, you will be redirected to a page.');
  console.log('      Copy the entire redirected URL from your browser address bar (it will contain "code=...")');

  const rawInput = await askQuestion('\n👉 3. Paste the redirected URL (or the authorization code): ');
  
  let code = rawInput.trim();
  if (code.includes('code=')) {
    try {
      const urlObj = new URL(code.startsWith('http') ? code : `http://localhost?${code}`);
      code = urlObj.searchParams.get('code') || code;
    } catch (e) {
      // fallback if parsing fails
    }
  }

  if (!code) {
    console.error('\n❌ Error: Could not extract authorization code.');
    process.exit(1);
  }

  console.log('\nExchanging authorization code for tokens...');
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Failed to exchange code');
    }

    console.log('\n🎉 SUCCESS! Here are your tokens:');
    console.log('--------------------------------------------------');
    console.log('Access Token:', data.access_token);
    console.log('Refresh Token (GOOGLE_REFRESH_TOKEN):');
    console.log('\x1b[36m%s\x1b[0m', data.refresh_token);
    console.log('--------------------------------------------------\n');

    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /GOOGLE_REFRESH_TOKEN=.*/,
          `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`
        );
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('💾 Automatically updated GOOGLE_REFRESH_TOKEN in your backend/.env file!\n');
      } else {
        console.log(`Please manually update the GOOGLE_REFRESH_TOKEN value in backend/.env to:\n${data.refresh_token}\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ Token exchange failed:', error.message);
  } finally {
    rl.close();
  }
}

main();
