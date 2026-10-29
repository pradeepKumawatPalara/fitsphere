// npm run check:signup -w @fitsphere/api -- <your registered address>
// ADR-0004 step 2: calls Supabase Auth's sign-up directly with the publishable key, as anyone
// could, and checks that the answer does not reveal that the address is registered. Run it only
// with an address that already has an account; it uses a random password and prints only the
// HTTP status and PASS or FAIL.
import { randomBytes } from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.argv[2];
if (!supabaseUrl || !publishableKey || !email) {
  console.error('Usage: npm run check:signup -w @fitsphere/api -- <registered address>');
  console.error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in apps/api/.env.');
  process.exit(1);
}

const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: randomBytes(18).toString('base64url') }),
});
const body = await response.text();
const reveals = /already (been )?registered|user_already_exists|email_exists/i.test(body);
console.log(`HTTP ${response.status}`);
console.log(reveals ? 'FAIL: the answer says the address is registered.' : 'PASS: the answer does not say whether the address is registered.');
process.exit(reveals ? 1 : 0);
