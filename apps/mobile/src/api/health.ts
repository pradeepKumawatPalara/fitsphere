import { API_BASE_PATH } from '@fitsphere/shared';

export type ApiHealth = 'ok' | 'unreachable';

const TIMEOUT_MS = 5000;

// Calls GET /v1/health (api-conventions). Any failure, including a timeout, counts as unreachable.
export async function checkApiHealth(
  apiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${apiUrl}${API_BASE_PATH}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return 'unreachable';
    const body: unknown = await response.json();
    return isOkBody(body) ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}

function isOkBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok';
}
