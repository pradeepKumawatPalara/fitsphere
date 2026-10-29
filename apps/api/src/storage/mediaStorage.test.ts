import { describe, expect, it } from 'vitest';
import { createS3MediaStorage, mediaStorageFromEnv, photoKeys } from './mediaStorage.ts';

// The storage module (ADR-0002 rules 3 and 4). Presigning happens on the API without a network
// call, so the links can be checked here; whether Supabase honours them is `npm run check:storage`.
// Synthetic settings only.

const SETTINGS = {
  endpoint: 'https://project-ref.storage.supabase.co/storage/v1/s3',
  region: 'ap-south-1',
  bucket: 'meal-photos',
  accessKeyId: 'test-access-key-id',
  secretAccessKey: 'test-secret-access-key',
};
const [PHOTO, THUMBNAIL] = photoKeys('0f8e5a1c-9b7d-4c1e-8a2b-3c4d5e6f7a8b', '6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d');

describe('ADR-0002 rule 3 storage links', () => {
  it('viewing links read one file, path-style, for at most 5 minutes', async () => {
    const [link] = await createS3MediaStorage(SETTINGS).viewLinks([PHOTO]);
    const url = new URL(link!);

    expect(url.origin + url.pathname).toBe(
      'https://project-ref.storage.supabase.co/storage/v1/s3/meal-photos/meals/0f8e5a1c-9b7d-4c1e-8a2b-3c4d5e6f7a8b/6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.jpg',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
  });

  it('upload links put a JPEG at one key for 10 minutes, with no checksum the phone must match', async () => {
    const links = await createS3MediaStorage(SETTINGS).uploadLinks([PHOTO, THUMBNAIL]);
    const urls = links.map((link) => new URL(link));

    expect(urls.map((url) => url.pathname.split('/').at(-1))).toEqual([
      '6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.jpg',
      '6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d-thumb.jpg',
    ]);
    for (const url of urls) {
      expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('host');
      expect([...url.searchParams.keys()].filter((name) => name.toLowerCase().includes('checksum'))).toEqual([]);
    }
  });

  it('never puts the secret key in a link', async () => {
    const storage = createS3MediaStorage(SETTINGS);
    const links = [...(await storage.uploadLinks([PHOTO])), ...(await storage.viewLinks([PHOTO]))];

    for (const link of links) expect(link).not.toContain('test-secret-access-key');
  });

  it('is off until every configuration name is set', () => {
    const env = {
      STORAGE_S3_ENDPOINT: SETTINGS.endpoint,
      STORAGE_S3_REGION: SETTINGS.region,
      STORAGE_BUCKET: SETTINGS.bucket,
      STORAGE_S3_ACCESS_KEY_ID: SETTINGS.accessKeyId,
      STORAGE_S3_SECRET_ACCESS_KEY: SETTINGS.secretAccessKey,
    };
    expect(mediaStorageFromEnv(env)).not.toBeNull();
    expect(mediaStorageFromEnv({ ...env, STORAGE_BUCKET: '' })).toBeNull();
    expect(mediaStorageFromEnv({})).toBeNull();
  });
});
