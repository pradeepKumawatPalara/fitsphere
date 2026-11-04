import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_LABELS_HEADER, brandLabelName, readBrandLabelsSheet } from './brandLabels.ts';
import { FoodListError } from './ifct.ts';

// FitSphere's brand-labels sheet (D-49; docs/data/brand-labels-sheet.csv). The rows below are
// synthetic: made-up products and values to check the rules, not real labels.

const COMMITTED = readFileSync(new URL('../../../../docs/data/brand-labels-sheet.csv', import.meta.url), 'utf8');
const HEADER = BRAND_LABELS_HEADER.join(',');
// 4 × 0.5 + 4 × 0.5 + 9 × 80 = 724: agrees with 720 kcal.
const BUTTER = 'test-dairy-butter,Test Dairy,Salted Butter,approved,100 g,720,0.5,0.5,80,,1 serving,10,https://example.com/butter,2026-11-04,"Per 100 g: energy 720 kcal"';

function sheet(...rows: string[]) {
  return readBrandLabelsSheet([HEADER, ...rows].join('\n'));
}

function refused(...rows: string[]): string {
  try {
    sheet(...rows);
  } catch (error) {
    expect(error).toBeInstanceOf(FoodListError);
    return (error as Error).message;
  }
  throw new Error('The sheet was accepted');
}

describe('D-49 the committed brand-labels sheet', () => {
  it('passes every check; nothing is imported until the owner approves a row', () => {
    expect(readBrandLabelsSheet(COMMITTED).foods).toEqual([]);
  });
});

describe('D-49 the sheet’s rules', () => {
  it('imports an approved row as a brand label, named with its brand, fibre unknown when not given, with its serving', () => {
    expect(sheet(BUTTER, BUTTER.replace('test-dairy-butter', 'test-dairy-ghee').replace(',approved,', ',proposed,'))).toEqual({
      foods: [
        {
          code: 'test-dairy-butter',
          name: 'Test Dairy Salted Butter',
          foodGroup: 'Test Dairy',
          proteinG: '0.5',
          fibreG: null,
          fatG: '80',
          carbsG: '0.5',
          kcal: '720',
          kcalSource: 'published',
          estimated: false,
          needsReview: false,
          hidden: false,
          note: null,
          aliases: ['Test Dairy'],
        },
      ],
      portions: [{ code: 'test-dairy-butter', seq: 1, label: 'Serving', grams: 10 }],
      proposed: 1,
    });
  });

  it('names a product once when it already starts with its brand', () => {
    expect(brandLabelName('Parle', 'Parle-G Gold')).toBe('Parle-G Gold');
    expect(brandLabelName('Amul', 'Pasteurised Butter')).toBe('Amul Pasteurised Butter');
  });

  it('refuses a row whose energy does not agree with its protein, carbs and fat', () => {
    expect(refused(BUTTER.replace(',720,', ',360,'))).toBe('Brand-labels sheet line 2: kcal 360 does not agree with protein, carbs and fat (724 kcal)');
  });

  it('checks the code, the status, the basis, the serving, the address and the date on every row', () => {
    expect(refused(BUTTER.replace('test-dairy-butter', 'Test Butter'))).toMatch(/line 2: code must be lowercase/);
    expect(refused(BUTTER, BUTTER)).toBe('Brand-labels sheet line 3: test-dairy-butter appears twice');
    expect(refused(BUTTER.replace(',approved,', ',done,'))).toBe('Brand-labels sheet line 2: status must be proposed or approved');
    expect(refused(BUTTER.replace(',100 g,', ',per serving,'))).toBe('Brand-labels sheet line 2: basis must be 100 g or 100 ml');
    expect(refused(BUTTER.replace(',1 serving,10,', ',1 serving,,'))).toBe('Brand-labels sheet line 2: serving and serving_grams go together');
    expect(refused(BUTTER.replace('https://example.com/butter', 'example.com/butter'))).toBe(
      'Brand-labels sheet line 2: source_url must be the https address of the brand’s page',
    );
    expect(refused(BUTTER.replace('2026-11-04', '2026-02-30'))).toBe('Brand-labels sheet line 2: read_on must be a real date, as YYYY-MM-DD');
  });

  it('refuses a sheet with another header', () => {
    expect(() => readBrandLabelsSheet('code,brand\n')).toThrow(FoodListError);
  });
});
