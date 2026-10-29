import { readFileSync } from 'node:fs';
import { IFCT_ACKNOWLEDGEMENT } from '@fitsphere/shared';
import { describe, expect, it } from 'vitest';
import { CsvError, parseCsv } from './csv.ts';
import { FoodListError, IFCT_HEADER, readIfctCsv } from './ifct.ts';

// The food-list import (ADR-0006 rule 1; D-25, D-26; docs/data/food-list-sources.md).

const CSV = readFileSync(new URL('../../../../data/foods/ifct2017-foods.csv', import.meta.url), 'utf8');
const SOURCES_DOC = readFileSync(new URL('../../../../docs/data/food-list-sources.md', import.meta.url), 'utf8');
const HEADER = IFCT_HEADER.join(',');

/** The text of each top-level block quote in a Markdown file, its lines joined with spaces. */
function blockQuotes(markdown: string): string[] {
  const quotes: string[] = [];
  let lines: string[] = [];
  for (const line of [...markdown.split(/\r?\n/), '']) {
    if (line.startsWith('> ')) {
      lines.push(line.slice(2));
    } else if (lines.length > 0) {
      quotes.push(lines.join(' '));
      lines = [];
    }
  }
  return quotes;
}

describe('D-25 the IFCT acknowledgement', () => {
  it('is the citation food-list-sources.md gives, word for word', () => {
    expect(blockQuotes(SOURCES_DOC)).toContain(IFCT_ACKNOWLEDGEMENT);
  });
});

describe('CSV reader', () => {
  it('reads quoted fields with commas, doubled quotes and line breaks', () => {
    expect(parseCsv('a,"b, c","d ""e""","f\ng"\n1,2,3,4\n')).toEqual([
      ['a', 'b, c', 'd "e"', 'f\ng'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('accepts CRLF endings, a byte-order mark and a missing final line break', () => {
    expect(parseCsv('﻿a,b\r\n1,\r\n2,3')).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['2', '3'],
    ]);
  });

  it('refuses an unclosed quote and text after a closing quote', () => {
    expect(() => parseCsv('a,"b\n')).toThrow(CsvError);
    expect(() => parseCsv('a,"b"c\n')).toThrow(CsvError);
    expect(() => parseCsv('a,b"c\n')).toThrow(CsvError);
  });
});

describe('ADR-0006 rule 1 the IFCT 2017 food list', () => {
  const foods = readIfctCsv(CSV);
  const byCode = new Map(foods.map((food) => [food.code, food]));

  it('reads all 542 foods with unique codes', () => {
    expect(foods).toHaveLength(542);
    expect(byCode.size).toBe(542);
  });

  it('keeps values exactly as printed (spot checks from food-list-sources.md)', () => {
    expect(byCode.get('D004')).toMatchObject({
      name: 'Bitter gourd, jagged, teeth ridges, elongate',
      foodGroup: 'Other Vegetables',
      proteinG: '1.44',
      fibreG: '3.78',
      fatG: '0.24',
      carbsG: '2.82',
      kcal: '21.00',
      kcalSource: 'published',
      estimated: false,
    });
    expect(byCode.get('H014')).toMatchObject({ name: 'Linseeds', fatG: '35.67', kcal: '444.00' });
    expect(byCode.get('A019')).toMatchObject({ name: 'Wheat flour, atta', proteinG: '10.57', kcal: '320.00' });
  });

  it('D-26 gives the 14 oils and fats 9 kcal per g of fat, marked estimated', () => {
    const estimated = foods.filter((food) => food.estimated);
    expect(estimated.map((food) => food.code)).toEqual(
      Array.from({ length: 14 }, (_, index) => `T${String(index + 1).padStart(3, '0')}`),
    );
    expect(byCode.get('T013')).toMatchObject({ name: 'Ghee', fatG: '100.00', kcal: '900.00', kcalSource: 'estimated_fat_factor' });
    expect(byCode.get('T002')).toMatchObject({ fatG: '100.01', kcal: '900.09' });
    expect(byCode.get('T003')).toMatchObject({ fatG: '99.99', kcal: '899.91' });
  });

  it('hides the three rows whose energy disagrees with their macronutrients, and only those', () => {
    expect(foods.filter((food) => food.hidden).map((food) => food.code)).toEqual(['N001', 'Q001', 'S007']);
    expect(foods.filter((food) => food.needsReview)).toHaveLength(17);
  });

  it('adds correct spellings as aliases without changing the printed names', () => {
    expect(byCode.get('E021')).toMatchObject({ name: 'Goosberry', aliases: ['Gooseberry'] });
    expect(byCode.get('M014')).toMatchObject({ name: 'Egg, quial, whole, raw', aliases: ['Egg, quail, whole, raw'] });
    expect(byCode.get('A019')?.aliases).toEqual([]);
  });
});

describe('ADR-0006 rule 1 a wrong file is refused whole', () => {
  const good = 'A001,"Amaranth seed, black",Cereals and Millets,14.59,7.02,5.74,59.98,356,published,no,';

  function refused(text: string): string {
    try {
      readIfctCsv(text);
    } catch (error) {
      expect(error).toBeInstanceOf(FoodListError);
      return (error as Error).message;
    }
    throw new Error('expected the file to be refused');
  }

  it('refuses a wrong header or an empty file', () => {
    expect(refused(`code,name\n${good}\n`)).toMatch(/header/);
    expect(refused(`${HEADER}\n`)).toMatch(/no foods/);
  });

  it.each([
    ['a missing field', 'A001,Name,Group,1.00,1.00,1.00,1.00,10,published,no'],
    ['a bad code', 'a01,Name,Group,1.00,1.00,1.00,1.00,10,published,no,'],
    ['a value without two decimals', 'A001,Name,Group,1.0,1.00,1.00,1.00,10,published,no,'],
    ['a calculated kcal', 'A001,Name,Group,1.00,1.00,1.00,1.00,10.5,published,no,'],
    ['kcal given while not published', 'A001,Name,Group,1.00,1.00,1.00,1.00,10,not published,yes,Why'],
    ['an unknown kcal source', 'A001,Name,Group,1.00,1.00,1.00,1.00,10,calculated,no,'],
    ['a review flag without its note', 'A001,Name,Group,1.00,1.00,1.00,1.00,10,published,yes,'],
    ['an empty name', 'A001,,Group,1.00,1.00,1.00,1.00,10,published,no,'],
  ])('refuses %s, naming the line', (_problem, row) => {
    expect(refused(`${HEADER}\n${good}\n${row}\n`)).toMatch(/^Line 3:/);
  });

  it('refuses a code that appears twice', () => {
    expect(refused(`${HEADER}\n${good}\n${good}\n`)).toMatch(/Line 3: the code A001 appears twice/);
  });
});
