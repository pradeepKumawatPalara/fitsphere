import { barcodeLookupSchema, type BarcodeProduct } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type BarcodeOutcome =
  | { kind: 'found'; product: BarcodeProduct }
  | { kind: 'notFound' }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

// GET /v1/barcodes/{barcode} (ADR-0006 rule 2). Only the barcode leaves the phone. One session
// refresh after a 401 (error model); anything else the app cannot use counts as unavailable.
export async function lookUpBarcode(auth: AuthDeps, barcode: string): Promise<BarcodeOutcome> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, `/barcodes/${encodeURIComponent(barcode)}`, {
      token: session.access_token,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      return { kind: 'unavailable' };
    }
    const parsed = barcodeLookupSchema.safeParse(response.body);
    if (!parsed.success) return { kind: 'unavailable' };
    return parsed.data.product ? { kind: 'found', product: parsed.data.product } : { kind: 'notFound' };
  }
  return { kind: 'unavailable' };
}
