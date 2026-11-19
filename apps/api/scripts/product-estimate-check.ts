// One real OpenAI call for the barcode estimate (D-117), run by hand on the owner's word:
//   npm run ai:estimate -w @fitsphere/api -- 8801062168279 "Lotte Choco Pie"
// Sends only the barcode digits and the name. Reads OPENAI_API_KEY and OPENAI_MODEL from apps/api/.env;
// never prints the key. Prints the estimate (a food's values, no personal data).
import { barcodeEstimateRequestSchema } from '@fitsphere/shared';
import { productEstimatorFromEnv, ProductEstimatorFailed } from '../src/ai/productEstimator.ts';

const [barcode, ...nameParts] = process.argv.slice(2);
const request = barcodeEstimateRequestSchema.safeParse({ barcode, name: nameParts.join(' ') });
if (!request.success) {
  console.error('Usage: npm run ai:estimate -w @fitsphere/api -- <barcode 8 to 14 digits> "<product name>"');
  process.exit(1);
}

const estimator = productEstimatorFromEnv(process.env);
if (!estimator) {
  console.error('OPENAI_API_KEY is not set in apps/api/.env');
  process.exit(1);
}

try {
  console.log(JSON.stringify(await estimator.estimate(request.data), null, 2));
} catch (error) {
  if (error instanceof ProductEstimatorFailed) {
    console.error(`Estimate failed: ${error.reason}${error.code ? ` (${error.code})` : ''}`);
  } else {
    console.error('Estimate failed.');
  }
  process.exit(1);
}
