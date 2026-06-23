/**
 * Cloudflare R2 Client — Phase 2 File Storage
 *
 * R2 is S3-compatible object storage. Free tier: 10GB-month storage,
 * 10 million Class A operations/month, no egress fees to internet.
 *
 * We store generated project files here:
 *   Key format: <project_id>/<file_path>
 *   Example:    abc-123/src/pages/Checkout.tsx
 *
 * The browser fetches files via a signed URL (Phase 2 will add a
 * /api/files/:projectId/:path route in CF Pages that proxies to R2
 * with a 5-minute signed URL).
 *
 * Env vars required:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET (default: palmkit-files)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from 'aws-sdk-compatible-s3';
import { getSignedUrl } from 'aws-sdk-compatible-s3-signer';
import { logger } from './logger';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET ?? 'palmkit-files';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  logger.warn(
    'R2 env vars missing — file storage will fail. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
  );
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Write a file to R2. Overwrites if exists.
 */
export async function putFile(key: string, content: string | Uint8Array): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: typeof content === 'string' ? new TextEncoder().encode(content) : content,
    }),
  );
  logger.debug(`R2 PUT ${key} (${typeof content === 'string' ? content.length : content.byteLength} bytes)`);
}

/**
 * Read a file from R2. Returns null if not found.
 */
export async function getFile(key: string): Promise<string | null> {
  try {
    const response = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    if (!response.Body) return null;
    const buf = await response.Body.transformToString('utf-8');
    return buf;
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

/**
 * Generate a signed URL for the browser to fetch a file directly from R2.
 * Valid for `expiresIn` seconds (default 300 = 5 minutes).
 */
export async function getSignedFileUrl(key: string, expiresIn = 300): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

/**
 * Build the R2 key for a project file.
 *   buildKey(projectId, 'src/pages/Checkout.tsx')
 *   → 'abc-123/src/pages/Checkout.tsx'
 */
export function buildKey(projectId: string, filePath: string): string {
  // Normalize: strip leading slashes, prevent path traversal
  const normalized = filePath.replace(/^\/+/, '').replace(/\.\./g, '');
  return `${projectId}/${normalized}`;
}
