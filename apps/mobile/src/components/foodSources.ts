import type { Food } from '@fitsphere/shared';

/** The tag a listed food's source is marked with (D-46); IFCT's foods, the list's own, have none. */
export const SOURCE_MARKS: Record<Food['source'], string | null> = { ifct2017: null, indb: 'INDB' };
