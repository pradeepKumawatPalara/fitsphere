// The one place the API calls Open Food Facts (ADR-0006 rules 2 and 5). Only the barcode is sent,
// never anything about the user. API v3, which Open Food Facts recommends for new integrations;
// its product read is limited to 15 requests a minute per IP address, so the route caches every
// answer (app.barcode_products). Behaviour checked against live responses on 2026-10-29: a found
// product answers 200 with `status: "success"`; an unknown barcode answers 404.
import type { BarcodeProduct } from '@fitsphere/shared';

export type ProductAnswer = { found: true; product: BarcodeProduct } | { found: false } | 'unavailable';

export type BarcodeSource = { lookup(barcode: string): Promise<ProductAnswer> };

const PRODUCTION = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 8_000;

/**
 * `contact` goes in the User-Agent, as Open Food Facts asks: "AppName/Version (ContactEmail)".
 * Without it, lookups are not made and the route answers SERVICE_UNAVAILABLE.
 */
export function createOpenFoodFacts(options: { contact: string | undefined; fetchImpl?: typeof fetch; baseUrl?: string }): BarcodeSource {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? PRODUCTION;
  return {
    async lookup(barcode) {
      if (!options.contact) return 'unavailable';
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/api/v3/product/${barcode}.json?fields=product_name,brands,nutriments`, {
          headers: { 'User-Agent': `FitSphere/1.0 (${options.contact})`, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        return 'unavailable';
      }
      if (response.status === 404) return { found: false };
      if (!response.ok) return 'unavailable';
      const body = (await response.json().catch(() => null)) as OffBody | null;
      if (!body || body.status !== 'success' || !body.product) return 'unavailable';
      return { found: true, product: toProduct(barcode, body.product, baseUrl) };
    },
  };
}

type OffBody = {
  status?: unknown;
  product?: { product_name?: unknown; brands?: unknown; nutriments?: Record<string, unknown> };
};

function toProduct(barcode: string, product: NonNullable<OffBody['product']>, baseUrl: string): BarcodeProduct {
  const nutriments = product.nutriments ?? {};
  const name = typeof product.product_name === 'string' && product.product_name.trim() !== '' ? product.product_name.trim() : `Product ${barcode}`;
  const brand = typeof product.brands === 'string' && product.brands.trim() !== '' ? product.brands.split(',')[0]!.trim() : null;
  return {
    name: name.slice(0, 100),
    brand: brand ? brand.slice(0, 60) : null,
    kcal: per100g(nutriments, 'energy-kcal', 'kcal', 900),
    proteinG: per100g(nutriments, 'proteins', 'g', 100),
    carbsG: per100g(nutriments, 'carbohydrates', 'g', 100),
    fatG: per100g(nutriments, 'fat', 'g', 100),
    fibreG: per100g(nutriments, 'fiber', 'g', 100),
    sourceUrl: `${baseUrl}/product/${barcode}`,
  };
}

/**
 * A value per 100 g, used only in the unit FitSphere expects (Open Food Facts gives `_100g` "in
 * original unit") and only when plausible; anything else is treated as not given.
 */
function per100g(nutriments: Record<string, unknown>, name: string, unit: string, max: number): number | null {
  const value = nutriments[`${name}_100g`];
  const givenUnit = nutriments[`${name}_unit`];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) return null;
  if (givenUnit !== undefined && givenUnit !== unit) return null;
  return Math.round(value * 100) / 100;
}
