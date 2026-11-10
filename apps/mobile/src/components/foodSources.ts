import type { Food } from '@fitsphere/shared';

/** What a brand label's values are (D-49): each brand's own, read from its page, which FitSphere keeps. */
export const BRAND_LABEL_CREDIT =
  'values as printed on each product’s label, read from the brand’s website, a shop’s listing of the product or Open Food Facts; FitSphere keeps the page each was read from.';

/** What the home-style foods' values are (D-59): typical for a home recipe, not any brand's. */
export const HOME_FOODS_CREDIT = 'typical values for a home recipe of each, not any brand’s product.';

/** What the estimated dishes' values are (D-62): their type of dish's, not measured for each dish. */
export const DISH_ESTIMATES_CREDIT =
  'typical values for each type of dish (a dry sabzi, a dal, a pulao), not measured for each dish, from the owner’s dish database; a dish whose type did not fit was left out.';

/**
 * The tag a listed food's source is marked with (D-46, D-49); IFCT's foods, the list's own, have none,
 * nor have the home-style foods (D-59: the owner means to drop the tags). An estimated dish's page
 * says so (D-62).
 */
export const SOURCE_MARKS: Record<Food['source'], string | null> = {
  ifct2017: null,
  indb: 'INDB',
  brand_label: 'Brand label',
  home: null,
  dish_estimate: 'Estimated dish',
};
