// The one place the API calls Open Food Facts (ADR-0006 rules 2 and 5). Only the barcode is sent,
// never anything about the user. API v3, which Open Food Facts recommends for new integrations;
// its product read is limited to 15 requests a minute per IP address, so the route caches every
// answer (app.barcode_products). Behaviour checked against live responses on 2026-10-29: a found
// product answers 200 with `status: "success"`; an unknown barcode answers 404.
import type { BarcodeEstimateResponse, BarcodeProduct } from '@fitsphere/shared';
import { energyAgrees } from '../ai/productEstimator.ts';

export type ProductAnswer = { found: true; product: BarcodeProduct } | { found: false } | 'unavailable';

export type BarcodeSource = { lookup(barcode: string): Promise<ProductAnswer> };

/** A food looked up by name (D-118): only the name is sent. Null for none, a failure or no contact. */
export type FoodNameSource = { searchByName(name: string): Promise<BarcodeEstimateResponse | null> };

const PRODUCTION = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 8_000;
const NAME_SEARCH_TIMEOUT_MS = 6_000;

/**
 * `contact` goes in the User-Agent, as Open Food Facts asks: "AppName/Version (ContactEmail)".
 * Without it, lookups are not made and the route answers SERVICE_UNAVAILABLE.
 */
export function createOpenFoodFacts(options: { contact: string | undefined; fetchImpl?: typeof fetch; baseUrl?: string }): BarcodeSource & FoodNameSource {
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
    async searchByName(name) {
      if (!options.contact) return null;
      const query = new URLSearchParams({
        search_terms: name,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '10',
        sort_by: 'unique_scans_n',
        fields: 'product_name,brands,nutriments',
      });
      try {
        const response = await fetchImpl(`${baseUrl}/cgi/search.pl?${query.toString()}`, {
          headers: { 'User-Agent': `FitSphere/1.0 (${options.contact})`, Accept: 'application/json' },
          signal: AbortSignal.timeout(NAME_SEARCH_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const body = (await response.json().catch(() => null)) as { products?: unknown } | null;
        if (!body || !Array.isArray(body.products)) return null;
        for (const product of body.products) {
          const found = fromSearch(product);
          if (found) return found;
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}

/** The first usable product of a search: a name and kcal, protein, carbs and fat per 100 g that agree. */
function fromSearch(product: unknown): BarcodeEstimateResponse | null {
  if (typeof product !== 'object' || product === null) return null;
  const { product_name, brands, nutriments } = product as { product_name?: unknown; brands?: unknown; nutriments?: unknown };
  if (typeof product_name !== 'string' || product_name.trim() === '') return null;
  const values = typeof nutriments === 'object' && nutriments !== null ? (nutriments as Record<string, unknown>) : {};
  const kcal = per100g(values, 'energy-kcal', 'kcal', 900);
  const proteinG = per100g(values, 'proteins', 'g', 100);
  const carbsG = per100g(values, 'carbohydrates', 'g', 100);
  const fatG = per100g(values, 'fat', 'g', 100);
  if (kcal === null || proteinG === null || carbsG === null || fatG === null) return null;
  const brand = typeof brands === 'string' && brands.trim() !== '' ? brands.split(',')[0]!.trim().slice(0, 80) : '';
  const answer: BarcodeEstimateResponse = {
    name: product_name.trim().slice(0, 120),
    brand: brand === '' ? null : brand,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fibreG: per100g(values, 'fiber', 'g', 100),
  };
  return energyAgrees(answer) ? answer : null;
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
