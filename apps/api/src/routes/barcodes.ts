import { API_BASE_PATH, barcodeSchema, type BarcodeLookup, type BarcodeProduct } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { ApiError } from '../errors.ts';
import type { BarcodeSource } from '../foods/openFoodFacts.ts';

/** A barcode Open Food Facts did not know is asked about again after this long (MVP default, D-26). */
const NOT_FOUND_RETRY_MS = 24 * 60 * 60 * 1000;

// GET /v1/barcodes/{barcode} (ADR-0006 rule 2): a packaged product's values per 100 g. Answered
// from app.barcode_products when it can be; otherwise Open Food Facts is asked, with the barcode
// only, and the answer kept. The table is reference data with no user data, so it does not record
// who looked a barcode up. Found products are kept with no refresh in the MVP.
export function registerBarcodesRoute(app: FastifyInstance, deps: { db: Pick<pg.Pool, 'query'>; barcodes: BarcodeSource; now: () => Date }) {
  app.get(`${API_BASE_PATH}/barcodes/:barcode`, { config: { access: 'account' } }, async (request) => {
    const { barcode } = request.params as { barcode: string };
    if (!barcodeSchema.safeParse(barcode).success) {
      throw new ApiError('VALIDATION_FAILED', [{ field: 'barcode', issue: 'invalid_format' }]);
    }

    const { rows } = await deps.db.query<StoredProduct>(
      `select found, name, brand, kcal_100g::float8 as kcal, protein_100g::float8 as protein_g, carbs_100g::float8 as carbs_g,
              fat_100g::float8 as fat_g, fibre_100g::float8 as fibre_g, source_url, fetched_at
       from app.barcode_products where barcode = $1`,
      [barcode],
    );
    const stored = rows[0];
    if (stored?.found) return answer(barcode, fromRow(stored));
    if (stored && deps.now().getTime() - stored.fetched_at.getTime() < NOT_FOUND_RETRY_MS) return answer(barcode, null);

    const result = await deps.barcodes.lookup(barcode);
    if (result === 'unavailable') throw new ApiError('SERVICE_UNAVAILABLE');
    const product = result.found ? result.product : null;
    await deps.db.query(
      `insert into app.barcode_products (barcode, found, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, fibre_100g,
         source_url, fetched_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (barcode) do update set found = excluded.found, name = excluded.name, brand = excluded.brand,
         kcal_100g = excluded.kcal_100g, protein_100g = excluded.protein_100g, carbs_100g = excluded.carbs_100g,
         fat_100g = excluded.fat_100g, fibre_100g = excluded.fibre_100g, source_url = excluded.source_url,
         fetched_at = excluded.fetched_at`,
      [
        barcode,
        product !== null,
        product?.name ?? null,
        product?.brand ?? null,
        product?.kcal ?? null,
        product?.proteinG ?? null,
        product?.carbsG ?? null,
        product?.fatG ?? null,
        product?.fibreG ?? null,
        product?.sourceUrl ?? null,
        deps.now(),
      ],
    );
    return answer(barcode, product);
  });
}

type StoredProduct = {
  found: boolean;
  name: string | null;
  brand: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  source_url: string | null;
  fetched_at: Date;
};

function fromRow(row: StoredProduct): BarcodeProduct {
  return {
    name: row.name ?? '',
    brand: row.brand,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
    sourceUrl: row.source_url ?? '',
  };
}

function answer(barcode: string, product: BarcodeProduct | null): BarcodeLookup {
  return { barcode, found: product !== null, product };
}
