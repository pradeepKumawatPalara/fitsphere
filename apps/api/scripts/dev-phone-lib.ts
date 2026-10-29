// Pure parts of `npm run dev:phone` (dev-phone.ts), kept apart so they can be tested without
// starting processes.
import { API_BASE_PATH } from '@fitsphere/shared';

export const API_URL_NAME = 'EXPO_PUBLIC_API_URL';

/**
 * The Quick Tunnel's address in cloudflared's output, or null until it appears. Quick Tunnel names
 * are words joined by hyphens; requiring a hyphen skips `api.trycloudflare.com`, which cloudflared
 * names in its own error messages.
 */
export function findTunnelAddress(output: string): string | null {
  return /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/.exec(output)?.[0] ?? null;
}

/** Whether cloudflared has connected the tunnel to Cloudflare's edge. */
export function isTunnelConnected(output: string): boolean {
  return /Registered tunnel connection/.test(output);
}

/**
 * Sets `name=value` in the text of a `.env` file. Every other line is kept as it is, including
 * comments and CRLF line endings; the line is added when missing.
 */
export function setEnvValue(content: string, name: string, value: string): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const pattern = new RegExp(`^\\s*${name}\\s*=`);
  let found = false;
  const updated = lines.map((line) => {
    if (!pattern.test(line)) return line;
    found = true;
    return `${name}=${value}`;
  });
  if (!found) {
    // Keep a final newline last: insert before the empty string that split leaves for it.
    if (updated.at(-1) === '') updated.splice(-1, 0, `${name}=${value}`);
    else updated.push(`${name}=${value}`);
  }
  return updated.join(newline);
}

/** Whether `GET <base>/v1/health` answers `{ "status": "ok" }`. */
export async function isApiHealthy(base: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(`${base}${API_BASE_PATH}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: unknown };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

/** Checks `condition` until it holds or `timeoutMs` passes. */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 1000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await condition()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
