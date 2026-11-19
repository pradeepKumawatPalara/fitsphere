import { describe, expect, it } from 'vitest';
import { createOpenFoodFacts } from './openFoodFacts.ts';

// The Open Food Facts client (ADR-0006 rule 2). The found body is the shape of a live v3 response
// read on 2026-10-29 (barcode 3017624010701), trimmed to the fields FitSphere reads.

const FOUND = {
  code: '3017624010701',
  errors: [],
  product: {
    brands: 'Ferrero',
    nutriments: {
      'energy-kcal_100g': 539,
      'energy-kcal_unit': 'kcal',
      proteins_100g: 6.3,
      proteins_unit: 'g',
      carbohydrates_100g: 57.5,
      carbohydrates_unit: 'g',
      fat_100g: 30.9,
      fat_unit: 'g',
    },
    product_name: 'Nutella',
  },
  result: { id: 'product_found', lc_name: 'Product found', name: 'Product found' },
  status: 'success',
  warnings: [],
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('ADR-0006 rule 2 the Open Food Facts client', () => {
  it('sends only the barcode, with FitSphere’s User-Agent, to API v3', async () => {
    const { fetchImpl, calls } = fakeFetch(200, FOUND);

    await createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl }).lookup('3017624010701');

    expect(calls).toEqual([
      {
        url: 'https://world.openfoodfacts.org/api/v3/product/3017624010701.json?fields=product_name,brands,nutriments',
        headers: { 'User-Agent': 'FitSphere/1.0 (owner@example.test)', Accept: 'application/json' },
      },
    ]);
  });

  it('reads a found product’s values per 100 g; a value it does not give is null', async () => {
    const { fetchImpl } = fakeFetch(200, FOUND);

    const answer = await createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl }).lookup('3017624010701');

    expect(answer).toEqual({
      found: true,
      product: {
        name: 'Nutella',
        brand: 'Ferrero',
        kcal: 539,
        proteinG: 6.3,
        carbsG: 57.5,
        fatG: 30.9,
        fibreG: null,
        sourceUrl: 'https://world.openfoodfacts.org/product/3017624010701',
      },
    });
  });

  it('treats 404 as not found, and errors, odd bodies and network failures as unavailable', async () => {
    const lookup = (status: number, body: unknown) =>
      createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl: fakeFetch(status, body).fetchImpl }).lookup('12345678');

    expect(await lookup(404, {})).toEqual({ found: false });
    expect(await lookup(503, {})).toBe('unavailable');
    expect(await lookup(200, { status: 'failure' })).toBe('unavailable');
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl: failing }).lookup('12345678')).toBe('unavailable');
  });

  it('makes no call without a contact address', async () => {
    const { fetchImpl, calls } = fakeFetch(200, FOUND);

    expect(await createOpenFoodFacts({ contact: undefined, fetchImpl }).lookup('3017624010701')).toBe('unavailable');
    expect(calls).toEqual([]);
  });

  it('ignores a value in another unit or out of range, and names a product without a name by its barcode', async () => {
    const odd = {
      ...FOUND,
      product: {
        product_name: ' ',
        nutriments: { 'energy-kcal_100g': 120, proteins_100g: 300, proteins_unit: 'mg', fat_100g: -1, fiber_100g: 3, fiber_unit: 'g' },
      },
    };
    const { fetchImpl } = fakeFetch(200, odd);

    const answer = await createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl }).lookup('12345678');

    expect(answer).toMatchObject({
      found: true,
      product: { name: 'Product 12345678', brand: null, kcal: 120, proteinG: null, fatG: null, fibreG: 3 },
    });
  });
});

// A food looked up by name (D-118): only the name is sent; the first product with kcal, protein, carbs
// and fat per 100 g that agree is used; anything else is "nothing found".
describe('D-118 the Open Food Facts name search', () => {
  const PRODUCT = {
    product_name: 'Zorblax Crunch Bar',
    brands: 'Zorblax, Other',
    nutriments: {
      'energy-kcal_100g': 430,
      'energy-kcal_unit': 'kcal',
      proteins_100g: 9,
      carbohydrates_100g: 60,
      fat_100g: 17,
      fiber_100g: 3,
    },
  };
  const search = (body: unknown, status = 200) => {
    const fake = fakeFetch(status, body);
    return { fake, found: createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl: fake.fetchImpl }).searchByName('zorblax crunch bar') };
  };

  it('sends only the name, in the query, with FitSphere’s User-Agent', async () => {
    const { fake, found } = search({ products: [PRODUCT] });
    await found;
    expect(fake.calls).toHaveLength(1);
    const url = new URL(fake.calls[0]!.url);
    expect(url.origin + url.pathname).toBe('https://world.openfoodfacts.org/cgi/search.pl');
    expect(url.searchParams.get('search_terms')).toBe('zorblax crunch bar');
    expect([...url.searchParams.keys()].sort()).toEqual(['action', 'fields', 'json', 'page_size', 'search_simple', 'search_terms', 'sort_by']);
    expect(fake.calls[0]!.headers).toEqual({ 'User-Agent': 'FitSphere/1.0 (owner@example.test)', Accept: 'application/json' });
  });

  it('returns the first usable product’s values per 100 g, skipping one without protein or with values that disagree', async () => {
    const noProtein = { ...PRODUCT, product_name: 'No protein', nutriments: { ...PRODUCT.nutriments, proteins_100g: undefined } };
    const disagree = { ...PRODUCT, product_name: 'Disagrees', nutriments: { ...PRODUCT.nutriments, 'energy-kcal_100g': 120 } };
    const { found } = search({ products: [noProtein, disagree, null, PRODUCT] });
    expect(await found).toEqual({ name: 'Zorblax Crunch Bar', brand: 'Zorblax', kcal: 430, proteinG: 9, carbsG: 60, fatG: 17, fibreG: 3 });
  });

  it('finds nothing for no products, an error, an odd body, a network failure or no contact address', async () => {
    expect(await search({ products: [] }).found).toBeNull();
    expect(await search({ products: [{ product_name: ' ', nutriments: PRODUCT.nutriments }] }).found).toBeNull();
    expect(await search({}, 503).found).toBeNull();
    expect(await search({ nothing: true }).found).toBeNull();
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await createOpenFoodFacts({ contact: 'owner@example.test', fetchImpl: failing }).searchByName('x y')).toBeNull();
    const noContact = fakeFetch(200, { products: [PRODUCT] });
    expect(await createOpenFoodFacts({ contact: undefined, fetchImpl: noContact.fetchImpl }).searchByName('zorblax')).toBeNull();
    expect(noContact.calls).toEqual([]);
  });
});
