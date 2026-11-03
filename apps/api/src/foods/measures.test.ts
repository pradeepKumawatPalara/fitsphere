import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOOD_MEASURES } from '@fitsphere/shared';
import { FoodListError, readIfctCsv } from './ifct.ts';
import { MEASURE_NAMES, MEASURES_SHEET_HEADER, readMeasuresSheet } from './measures.ts';

// FitSphere's household-measures sheet (D-36; docs/data/food-list-sources.md, "Household units").
// The approved rows below are synthetic: made-up grams to check the rules, not measurements. Their
// foods are real IFCT rows, named as the list names them.

const FOODS = readIfctCsv(readFileSync(new URL('../../../../data/foods/ifct2017-foods.csv', import.meta.url), 'utf8'));
const COMMITTED_SHEET = readFileSync(new URL('../../../../docs/data/household-measures-sheet.csv', import.meta.url), 'utf8');

const HEADER = MEASURES_SHEET_HEADER.join(',');
const MILK = 'L002,"Milk, whole, Cow",glass (250 ml)';

function sheet(...rows: string[]) {
  return readMeasuresSheet([HEADER, ...rows].join('\n'), FOODS);
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

describe('D-36 the committed household-measures sheet', () => {
  it('passes every check; its rows wait for the owner’s measurements, so none is imported', () => {
    expect(readMeasuresSheet(COMMITTED_SHEET, FOODS)).toEqual({ measures: [], pending: 19 });
  });

  it('names every unit of the contract, with its size', () => {
    expect(Object.values(MEASURE_NAMES).sort()).toEqual([...FOOD_MEASURES].sort());
  });
});

describe('D-36 the sheet’s rules', () => {
  it('imports an approved row as the food’s code, the unit and the grams one holds', () => {
    expect(
      sheet(`${MILK},approved,258,Owner,2026-11-03,`, 'T013,Ghee,teaspoon (5 ml),approved,4.6,Owner,2026-11-03,', 'T013,Ghee,tablespoon (15 ml),pending,,,,'),
    ).toEqual({
      measures: [
        { code: 'L002', measure: 'glass', grams: 258 },
        { code: 'T013', measure: 'teaspoon', grams: 4.6 },
      ],
      pending: 1,
    });
  });

  it('an approved row needs its grams, who measured it and when', () => {
    expect(refused(`${MILK},approved,,Owner,2026-11-03,`)).toBe('Household-measures sheet line 2: an approved row needs grams_per_measure');
    expect(refused(`${MILK},approved,258,,2026-11-03,`)).toBe('Household-measures sheet line 2: an approved row needs measured_by');
    expect(refused(`${MILK},approved,258,Owner,,`)).toBe('Household-measures sheet line 2: an approved row needs the date it was measured');
  });

  it('checks the food against the IFCT list, the unit, the status, the grams and the date on every row', () => {
    expect(refused('L999,"Milk, whole, Cow",glass (250 ml),pending,,,,')).toBe('Household-measures sheet line 2: ifct_code: L999 is not in the IFCT list');
    expect(refused('L002,Cow milk,glass (250 ml),pending,,,,')).toBe(
      'Household-measures sheet line 2: ifct_code: L002 is "Milk, whole, Cow" in the IFCT list, not "Cow milk"',
    );
    expect(refused('L002,"Milk, whole, Cow",cup,pending,,,,')).toMatch(/line 2: measure must be one of: teaspoon \(5 ml\), tablespoon \(15 ml\)/);
    expect(refused(`${MILK},done,,,,`)).toBe('Household-measures sheet line 2: status must be pending or approved');
    for (const grams of ['0', '1000.01', '25.125', 'about 250']) {
      expect(refused(`${MILK},pending,${grams},,,`)).toMatch(/line 2: grams_per_measure must be more than 0 and at most 1,000 g/);
    }
    expect(refused(`${MILK},pending,,,2026-02-30,`)).toBe('Household-measures sheet line 2: date must be a real date, as YYYY-MM-DD');
  });

  it('refuses a food’s unit given twice, and a unit for a food hidden until checked', () => {
    expect(refused(`${MILK},pending,,,,`, `${MILK},pending,,,,`)).toBe('Household-measures sheet line 3: L002 has the glass twice');
    const hidden = FOODS.find((food) => food.hidden)!;
    expect(refused(`${hidden.code},"${hidden.name}",piece,approved,10,Owner,2026-11-03,`)).toBe(
      `Household-measures sheet line 2: ${hidden.code} is hidden until checked, so it cannot have an approved unit`,
    );
  });

  it('refuses a sheet with another header, and skips rows left empty', () => {
    expect(() => readMeasuresSheet('code,food\n', FOODS)).toThrow(FoodListError);
    expect(sheet(',,,,,,,', `${MILK},pending,,,,`)).toEqual({ measures: [], pending: 1 });
  });
});
