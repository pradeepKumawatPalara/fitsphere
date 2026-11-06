import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_LABELS_HEADER, brandLabelName, readBrandLabelsSheet } from './brandLabels.ts';
import { FoodListError } from './ifct.ts';

// FitSphere's brand-labels sheet (D-49; docs/data/brand-labels-sheet.csv). The rows below are
// synthetic: made-up products and values to check the rules, not real labels.

const COMMITTED = readFileSync(new URL('../../../../docs/data/brand-labels-sheet.csv', import.meta.url), 'utf8');
const HEADER = BRAND_LABELS_HEADER.join(',');
// 4 × 0.5 + 4 × 0.5 + 9 × 80 = 724: agrees with 720 kcal. The row up to its flag and search words.
const BUTTER_TO_NOTES = 'test-dairy-butter,Test Dairy,Salted Butter,approved,100 g,720,0.5,0.5,80,,1 serving,10,https://example.com/butter,2026-11-04,"Per 100 g: energy 720 kcal"';
/** The butter row with a flag (D-52, D-53) and search words (D-55). */
const butter = (flag = '', searchWords = '') => `${BUTTER_TO_NOTES},${flag},${searchWords}`;
const BUTTER = butter();

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
  it('passes every check; the owner approved its first 23 rows on 2026-11-04, then 187, 56, 222, 12, 25, 3, 38, 1 and 63 more on 2026-11-06 (D-52, D-53)', () => {
    const sheet = readBrandLabelsSheet(COMMITTED);
    expect(sheet.foods).toHaveLength(630);
    expect(sheet.proposed).toBe(0);
    expect(sheet.foods.every((food) => food.kcalSource === 'published' && !food.estimated)).toBe(true);
  });

  it('flags the 199 rows read from the web as scrap, the 408 AI estimates as llm, and none of the first 23 (D-52, D-53)', () => {
    const { foods } = readBrandLabelsSheet(COMMITTED);
    expect(foods.filter((food) => food.flag === 'scrap')).toHaveLength(199);
    expect(foods.filter((food) => food.flag === 'llm')).toHaveLength(408);
    expect(foods.slice(0, 23).every((food) => food.flag === undefined)).toBe(true);
  });

  it('gives a chakki atta the search words of whole wheat atta, so "whole wheat atta" finds every brand (D-55)', () => {
    const { foods } = readBrandLabelsSheet(COMMITTED);
    const fortune = foods.find((food) => food.code === 'fortune-chakki-fresh-atta');
    expect(fortune?.aliases).toEqual(['Fortune', 'whole wheat atta', 'wheat flour', 'gehu atta']);
    expect(foods.filter((food) => food.aliases.length > 1).length).toBeGreaterThan(500);
  });

  it('gives each food its group as a search word too: "pulses" finds rajma and toor dal (D-55)', () => {
    const { foods } = readBrandLabelsSheet(COMMITTED);
    const aliases = (code: string) => foods.find((food) => food.code === code)?.aliases ?? [];
    expect(aliases('tata-sampann-rajma')).toEqual(expect.arrayContaining(['pulses', 'lentils']));
    expect(aliases('fortune-toor-dal')).toEqual(expect.arrayContaining(['arhar dal', 'pulses']));
    expect(aliases('mdh-turmeric-powder')).toEqual(expect.arrayContaining(['haldi', 'spices']));
    expect(aliases('amul-butter')).toEqual(expect.arrayContaining(['makhan', 'dairy']));
    expect(aliases('bisk-farm-rusk-cake')).toEqual(['Bisk Farm', 'bakery']);
  });

  it('does not give a jaljeera the words of cumin powder, nor a pasta those of cream biscuits', () => {
    const { foods } = readBrandLabelsSheet(COMMITTED);
    const aliases = (code: string) => foods.find((food) => food.code === code)?.aliases ?? [];
    expect(aliases('mdh-jaljeera')).toEqual(['MDH', 'spices']);
    expect(aliases('sunfeast-pasta-treat-masala')).toEqual(['Sunfeast', 'instant pasta', 'instant food']);
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

  it('carries a scrap or llm flag to the food, and refuses any other flag (D-52, D-53)', () => {
    expect(sheet(butter('scrap')).foods[0]).toMatchObject({ code: 'test-dairy-butter', flag: 'scrap' });
    expect(sheet(butter('llm')).foods[0]).toMatchObject({ code: 'test-dairy-butter', flag: 'llm' });
    expect(sheet(BUTTER).foods[0]).not.toHaveProperty('flag');
    expect(refused(butter('scraped'))).toBe('Brand-labels sheet line 2: flag must be empty or scrap or llm');
  });

  it('takes an llm row without a page, and still needs the page on every other row (D-53)', () => {
    const noPage = (flag = '') => butter(flag).replace('https://example.com/butter', '');
    expect(sheet(noPage('llm')).foods[0]).toMatchObject({ code: 'test-dairy-butter', flag: 'llm' });
    expect(refused(noPage('scrap'))).toBe('Brand-labels sheet line 2: source_url must be the https address of the brand’s page');
    expect(refused(noPage())).toBe('Brand-labels sheet line 2: source_url must be the https address of the brand’s page');
  });

  it('keeps search words as aliases after the brand, so a search for the item finds the product (D-55)', () => {
    expect(sheet(butter('', 'makhan; table butter')).foods[0]!.aliases).toEqual(['Test Dairy', 'makhan', 'table butter']);
    expect(sheet(BUTTER).foods[0]!.aliases).toEqual(['Test Dairy']);
    expect(refused(butter('', 'makhan; Makhan'))).toBe('Brand-labels sheet line 2: search_words gives a word twice');
    expect(refused(butter('', 'makhan;; butter'))).toMatch(/^Brand-labels sheet line 2: search_words must be/);
    expect(refused(butter('', 'butter!'))).toMatch(/^Brand-labels sheet line 2: search_words must be/);
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
