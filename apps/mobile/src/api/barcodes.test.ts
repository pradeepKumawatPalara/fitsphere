import { apiError, deps, fakeApi, fakeAuthClient, fakeSession } from '../testing/fakes';
import { lookUpBarcode } from './barcodes';

// GET /v1/barcodes/{barcode} from the app (ADR-0006 rule 2; error model). Synthetic product.

const PRODUCT = {
  name: 'Synthetic biscuits',
  brand: null,
  kcal: 480,
  proteinG: 7,
  carbsG: null,
  fatG: null,
  fibreG: null,
  sourceUrl: 'https://world.openfoodfacts.org/product/8901234567890',
};
const PATH = 'GET /barcodes/8901234567890';

it('refreshes the session once after a 401, then gets the product', async () => {
  const client = fakeAuthClient(fakeSession());
  const api = fakeApi({ [PATH]: [apiError(401, 'UNAUTHENTICATED'), { status: 200, body: { barcode: '8901234567890', found: true, product: PRODUCT } }] });

  expect(await lookUpBarcode(deps(client, api.fetchImpl), '8901234567890')).toEqual({ kind: 'found', product: PRODUCT });
  expect(client.refreshSession).toHaveBeenCalledTimes(1);
});

it('tells not found, offline and unavailable apart', async () => {
  const client = fakeAuthClient(fakeSession());
  const answer = async (reply: Parameters<typeof fakeApi>[0][string]) =>
    lookUpBarcode(deps(client, fakeApi({ [PATH]: reply }).fetchImpl), '8901234567890');

  expect(await answer({ status: 200, body: { barcode: '8901234567890', found: false, product: null } })).toEqual({ kind: 'notFound' });
  expect(await answer('offline')).toEqual({ kind: 'offline' });
  expect(await answer(apiError(503, 'SERVICE_UNAVAILABLE'))).toEqual({ kind: 'unavailable' });
  expect(await answer({ status: 200, body: { unexpected: true } })).toEqual({ kind: 'unavailable' });
});
