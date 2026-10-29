// npm run check:storage -w @fitsphere/api: checks the meal-photo bucket through the S3 interface
// the API uses (ADR-0002 rules 3 and 4, steps 2 and 5), with the Data API off. It writes one small
// synthetic file under `checks/`, never a photo, and removes it. Prints status codes only, never a
// link or a key.
import { randomUUID } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, createS3MediaStorage, s3SettingsFromEnv, VIEW_LINK_SECONDS } from '../src/storage/mediaStorage.ts';

const settings = s3SettingsFromEnv(process.env);
const supabaseUrl = process.env.SUPABASE_URL;
if (!settings || !supabaseUrl) {
  console.error(
    'Set SUPABASE_URL, STORAGE_S3_ENDPOINT, STORAGE_S3_REGION, STORAGE_BUCKET, STORAGE_S3_ACCESS_KEY_ID and ' +
      'STORAGE_S3_SECRET_ACCESS_KEY in apps/api/.env (runbook).',
  );
  process.exit(1);
}

const storage = createS3MediaStorage(settings);
const id = randomUUID();
const key = `checks/${id}.jpg`;
const body = new TextEncoder().encode(`FitSphere storage check ${id}`);
const results: { label: string; pass: boolean; detail: string }[] = [];

function record(label: string, pass: boolean, detail: string) {
  results.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
}

async function put(link: string, bytes: Uint8Array<ArrayBuffer>, contentType: string) {
  return fetch(link, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
}

try {
  const [uploadLink] = await storage.uploadLinks([key]);
  const uploaded = await put(uploadLink!, body, 'image/jpeg');
  record('upload with an upload link', uploaded.ok, `HTTP ${uploaded.status}`);

  const [viewLink] = await storage.viewLinks([key]);
  const expires = new URL(viewLink!).searchParams.get('X-Amz-Expires');
  record('viewing links last at most 5 minutes', expires === String(VIEW_LINK_SECONDS), `X-Amz-Expires=${expires}`);
  const viewed = await fetch(viewLink!);
  const same = viewed.ok && Buffer.from(await viewed.arrayBuffer()).equals(Buffer.from(body));
  record('read back with a viewing link', same, `HTTP ${viewed.status}${viewed.ok && !same ? ', different bytes' : ''}`);

  const unsigned = await fetch(`${supabaseUrl}/storage/v1/object/public/${settings.bucket}/${key}`);
  record('no reading without a link (private bucket)', !unsigned.ok, `HTTP ${unsigned.status}`);

  const [wrongTypeLink] = await storage.uploadLinks([`checks/${id}-type.jpg`]);
  const wrongType = await put(wrongTypeLink!, body, 'text/plain');
  record('only JPEG accepted (bucket rule)', !wrongType.ok, `HTTP ${wrongType.status}`);

  const [tooBigLink] = await storage.uploadLinks([`checks/${id}-big.jpg`]);
  const tooBig = await put(tooBigLink!, new Uint8Array(1_100_000), 'image/jpeg');
  record('files over 1 MB refused (bucket rule)', !tooBig.ok, `HTTP ${tooBig.status}`);

  const shortLink = await getSignedUrl(createS3Client(settings), new GetObjectCommand({ Bucket: settings.bucket, Key: key }), {
    expiresIn: 1,
  });
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const expired = await fetch(shortLink);
  record('an expired viewing link stops working', !expired.ok, `HTTP ${expired.status}`);

  await storage.remove([key, `checks/${id}-type.jpg`, `checks/${id}-big.jpg`]);
  const [afterLink] = await storage.viewLinks([key]);
  const after = await fetch(afterLink!);
  record('removed: the file is gone', !after.ok, `HTTP ${after.status}`);
} catch (error) {
  record('storage reachable', false, error instanceof Error ? error.name : 'error');
}

const failed = results.filter((result) => !result.pass).length;
console.log(failed === 0 ? 'PASS: storage behaves as ADR-0002 expects.' : `FAIL: ${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
