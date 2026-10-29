// The one place the API talks to file storage (ADR-0002 rule 4), through the S3 interface, so the
// provider can change without changing the app. In phase 1 it is Supabase Storage's S3 endpoint
// with S3 access keys, which bypass storage policies and live only on the server. The bucket is
// private. Supabase documents presigned links signed with AWS Signature Version 4 in the query
// string (supabase.com/docs/guides/storage/s3/compatibility, read 2026-10-29); the project checks
// them with `npm run check:storage` (runbook).
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** A viewing link works for at most 5 minutes (D-16, ADR-0002 rule 3). */
export const VIEW_LINK_SECONDS = 300;
/** An upload link works for 10 minutes: one JPEG to one key, with no viewing access. */
export const UPLOAD_LINK_SECONDS = 600;

export type MediaStorage = {
  /** One link per key, each allowing a JPEG to be put at that key. */
  uploadLinks(keys: string[]): Promise<string[]>;
  /** One link per key, each allowing that file to be read for VIEW_LINK_SECONDS. */
  viewLinks(keys: string[]): Promise<string[]>;
  /** Removes the files; a key with no file is not an error. */
  remove(keys: string[]): Promise<void>;
};

export type S3Settings = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

/** The S3 client for Supabase Storage's S3 endpoint (path-style, as Supabase's examples use). */
export function createS3Client(settings: S3Settings): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: true,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    // Only the checksums S3 requires, so presigned links carry no checksum the phone cannot match.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function createS3MediaStorage(settings: S3Settings): MediaStorage {
  const client = createS3Client(settings);
  const bucket = settings.bucket;
  return {
    uploadLinks: (keys) =>
      Promise.all(
        keys.map((key) =>
          getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }), {
            expiresIn: UPLOAD_LINK_SECONDS,
          }),
        ),
      ),
    viewLinks: (keys) =>
      Promise.all(
        keys.map((key) => getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: VIEW_LINK_SECONDS })),
      ),
    async remove(keys) {
      for (const key of keys) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/** The settings from the configuration names in the runbook; null when any is missing. */
export function s3SettingsFromEnv(env: Record<string, string | undefined>): S3Settings | null {
  const settings = {
    endpoint: env.STORAGE_S3_ENDPOINT,
    region: env.STORAGE_S3_REGION,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY,
  };
  return Object.values(settings).every((value) => value) ? (settings as S3Settings) : null;
}

/** Storage from the configuration names in the runbook; null when any is missing. */
export function mediaStorageFromEnv(env: Record<string, string | undefined>): MediaStorage | null {
  const settings = s3SettingsFromEnv(env);
  return settings ? createS3MediaStorage(settings) : null;
}

/** Where a meal photo and its thumbnail are kept. Only IDs, never anything the user typed. */
export function photoKeys(userId: string, mediaId: string): [photo: string, thumbnail: string] {
  return [`meals/${userId}/${mediaId}.jpg`, `meals/${userId}/${mediaId}-thumb.jpg`];
}
