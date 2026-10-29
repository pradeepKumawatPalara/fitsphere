// npm run check:data-api -w @fitsphere/api: after "Enable Data API" is turned off, Supabase's
// auto-generated REST endpoint must return no data (ADR-0002 step 2, ADR-0003 (e)).
// Uses only the publishable key, as anyone on the internet could.
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  console.error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in apps/api/.env.');
  process.exit(1);
}

const requests: { label: string; path: string; headers: Record<string, string> }[] = [
  { label: 'REST root', path: '/rest/v1/', headers: {} },
  { label: 'app.users', path: '/rest/v1/users?select=id&limit=1', headers: { 'Accept-Profile': 'app' } },
  { label: 'app.weigh_ins', path: '/rest/v1/weigh_ins?select=id&limit=1', headers: { 'Accept-Profile': 'app' } },
  { label: 'app.measurements', path: '/rest/v1/measurements?select=id&limit=1', headers: { 'Accept-Profile': 'app' } },
  { label: 'app.targets', path: '/rest/v1/targets?select=id&limit=1', headers: { 'Accept-Profile': 'app' } },
];

let anyData = false;
for (const request of requests) {
  const response = await fetch(`${supabaseUrl}${request.path}`, {
    headers: { apikey: publishableKey, ...request.headers },
  });
  const body = await response.text();
  if (response.status === 200) anyData = true;
  console.log(`${request.label}: HTTP ${response.status} ${body.slice(0, 200).replace(/\s+/g, ' ')}`);
}
console.log(anyData ? 'FAIL: the Data API answered 200.' : 'PASS: no request returned data.');
process.exit(anyData ? 1 : 0);
