import type { Food } from '@fitsphere/shared';

/** What a brand label's values are (D-49): each brand's own, read from its page, which FitSphere keeps. */
export const BRAND_LABEL_CREDIT = 'values as each brand publishes them on its own website; FitSphere keeps the page each was read from.';

/** The tag a listed food's source is marked with (D-46, D-49); IFCT's foods, the list's own, have none. */
export const SOURCE_MARKS: Record<Food['source'], string | null> = { ifct2017: null, indb: 'INDB', brand_label: 'Brand label' };
