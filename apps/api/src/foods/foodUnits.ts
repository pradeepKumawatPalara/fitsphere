// Units from the owner's consolidated food database (D-102): each row of its sheets "Dishes", "Branded
// packaged" and "Generic unbranded" gives a Default Unit and its Allowed Units with their grams
// ("katori:129.0g | bowl:215.0g | gram:1g"). `food-units:convert` reads them for the foods FitSphere has,
// matched as D-94 matched them (a dish by its name, a packaged food by its barcode, an IFCT food by its
// code, a generic food as D-94 placed it), and writes docs/data/food-units-sheet.csv: one row per food,
// the unit its page opens on and its units. `foods:import` loads them as the food's servings
// (app.food_portions, app.packaged_food_portions), after the food's own, a unit of the same name taking
// the sheet's grams (the owner: "keep the sheet value").
//
// The owner's rules (2026-11-13; docs/plans/food-units.md):
// - R2: a dish the file lists under several base foods with other units ("Idli" under Rice, 25.1 g,
//   and under Urad Dal, 45 g) keeps one row (the one of its own base, else the one whose default unit
//   weighs what its serving weighs, else the one whose base it names, else the first); each other row
//   becomes an estimated dish of its own, named with its base food: "Idli (Urad Dal)".
// - R3: a packaged food whose label gives a serving keeps it: the file's serving is left out.
// - R5: a drink the file counts below or above about 1 g per ml (milk at 0.8) is counted at 1.03 g per ml
//   for milk and milk drinks, 1.00 for the others, in ml and in its glass (250 ml), cup (200 ml), katori
//   (150 ml) and tablespoon (15 ml); a row the file calls liquid that is not a drink is only reported.
//   Every row changed or reported is written to docs/data/food-units-ml-fixes.csv for the owner.
//
// Running it again on the same files changes nothing more.
import { FOOD_OPENS_ON_GRAMS, ML_SERVING_LABEL, OZ_SERVING_LABEL, PACKAGED_SERVING_LABEL, SERVING_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import {
  ANOTHER_BASE_NOTE,
  baseWords,
  CONSOLIDATED_SHEETS,
  GENERIC_NOTE,
  GENERIC_SAME_AS,
  problemOf,
  servingOf,
  slug,
  tidyName,
  twoDecimals,
  WEAK_MATCH_ISSUE,
  withoutBrackets,
} from './consolidated.ts';
import { DISH_ESTIMATES_HEADER, readDishEstimatesSheet } from './dishEstimates.ts';
import { aliasKey } from './foodAliases.ts';
import { HOME_FOODS_HEADER } from './homeFoods.ts';
import { FoodListError } from './ifct.ts';
import type { ImportedPortion } from './usda.ts';

export const FOOD_UNITS_HEADER: readonly string[] = ['source', 'code', 'name', 'opens_on', 'units'];
/** The sources a row may be of: the food list's, and `packaged` for a packaged food, by its barcode. */
export const FOOD_UNIT_SOURCES = ['ifct2017', 'indb', 'home', 'dish_estimate', 'packaged'] as const;
export type FoodUnitSource = (typeof FOOD_UNIT_SOURCES)[number];
export const PACKAGED_UNIT_SOURCE = 'packaged';

export const ML_FIXES_HEADER: readonly string[] = ['sheet', 'name', 'base', 'archetype', 'ml_grams_before', 'ml_grams_now', 'units_before', 'units_now', 'note'];

/** One unit of a food and the grams one holds. */
export type FoodUnit = { label: string; grams: number };
/** A food's units, and the measure its page opens on (a unit's label, Grams, or the label's Serving). */
export type FoodUnits = { opensOn: string | null; units: FoodUnit[] };

/** A food of FitSphere's list a row may be. */
export type UnitsFood = { source: Exclude<FoodUnitSource, 'packaged'>; code: string; name: string };

export type FoodUnitsInput = {
  /** Each sheet's rows, its header first, as `readXlsxRows` reads them. */
  dishes: readonly (readonly string[])[];
  packaged: readonly (readonly string[])[];
  generic: readonly (readonly string[])[];
  /** IFCT's foods and INDB's recipes, as the food list has them. */
  ifct: readonly { code: string; name: string }[];
  indb: readonly { code: string; name: string }[];
  /** Each food's servings today, by "source code" (INDB, home-style, estimated dishes). */
  servings: ReadonlyMap<string, readonly { label: string; grams: number }[]>;
  /** The sheets as they are. */
  estimatesSheet: readonly (readonly string[])[];
  homeSheet: readonly (readonly string[])[];
  /** The packaged foods by barcode, with the grams of the serving their label gives, or null. */
  packagedServings: ReadonlyMap<string, number | null>;
  /** The day the sheets are made, YYYY-MM-DD. */
  readOn: string;
};

export type FoodUnitsResult = {
  unitsSheet: string[][];
  estimatesSheet: string[][];
  mlFixes: string[][];
  report: {
    foods: Record<FoodUnitSource, number>;
    units: number;
    /** R2: the other base foods' rows made dishes of their own, and those held with a problem. */
    anotherBaseAdded: string[];
    anotherBaseHeld: string[];
    /** Dish names two of FitSphere's foods share: left out, as in D-94. */
    ambiguous: number;
    /** Rows whose food FitSphere does not have. */
    unmatched: Record<'dishes' | 'packaged' | 'generic', number>;
    /** Units left out: over 2,000 g, named oz, a name too long. */
    unitsLeftOut: string[];
    /** R3: packaged foods whose label's serving is kept over the file's. */
    labelServingKept: number;
    /** R5: drinks fixed, and liquids that are not drinks, only reported. */
    mlFixed: number;
    mlNotADrink: number;
  };
};

type Cell = (name: string) => string;

/** One sheet's rows by their header's names; a column the file lacks refuses it. */
function columns(rows: readonly (readonly string[])[], sheet: string, names: readonly string[]): Cell[] {
  const header = rows[0] ?? [];
  const at = Object.fromEntries(
    names.map((name) => {
      const index = header.indexOf(name);
      if (index < 0) throw new FoodListError(`The workbook's sheet "${sheet}" has no column "${name}"`);
      return [name, index];
    }),
  );
  return rows.slice(1).map((row) => (name: string) => (row[at[name]!] ?? '').trim());
}

/** A unit as the file writes it, "katori:129.0g", with its name in lower case. */
type FileUnit = { name: string; grams: number };

/** The Allowed Units cell: "katori:129.0g | bowl:215.0g | gram:1g". */
export function readAllowedUnits(cell: string): FileUnit[] {
  const units: FileUnit[] = [];
  for (const part of cell.split('|')) {
    const text = part.trim();
    if (text === '') continue;
    const match = /^(.+?)\s*:\s*(\d+(?:\.\d+)?)\s*g$/i.exec(text);
    if (!match) throw new FoodListError(`An allowed unit is not "name:grams g": "${text}"`);
    units.push({ name: match[1]!.trim().toLowerCase(), grams: Number(match[2]) });
  }
  return units;
}

/** The volumes, in ml, of a drink's vessels as the file sizes them (at 1 g per ml: glass 250 g). */
export const DRINK_VOLUMES: Readonly<Record<string, number>> = { glass: 250, cup: 200, katori: 150, tablespoon: 15 };
/** A drink at about 1 g per ml: nothing to fix. */
const ML_PLAIN = { low: 0.97, high: 1.06 };
/** Milk and milk drinks, at 1.03 g per ml. */
const MILK = /milk|doodh|lassi|shake|\bnog\b/i;
const NOT_MILK = /coconut milk|soya milk|without milk/i;
/** A name that says it is drunk. */
const DRINK = /shikanji|juice|sharbat|\bwater\b|nimbu|soda|coffee|\btea\b|lassi|chaas|buttermilk|shake|\bdrink\b|\bpanna\b(?! cotta)|toddy|\bnog\b/i;
/** A row the file calls liquid that is eaten, not drunk: only reported. */
const NOT_A_DRINK =
  /fudge|pudding|kofta|curry|stew|sauce|pasta|sandwich|idli|vada|beans|panna cotta|huli|kuzhambu|kadhi|\bdal\b|daliya|chunks|fish|pachadi|cream$|sorbet|dudhi|masala|gravy|flakes|cereal|mousse|galette|cake/i;

/** R5: a drink's grams per ml, or null when it is not a drink. */
export function drinkGramsPerMl(name: string): number | null {
  if (!DRINK.test(name) && NOT_A_DRINK.test(name)) return null;
  return MILK.test(name) && !NOT_MILK.test(name) ? 1.03 : 1;
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function unitsText(units: readonly FileUnit[]): string {
  return units.map((unit) => `${unit.name}:${unit.grams}g`).join(' | ');
}

/** R5 for one row of Dishes or Generic unbranded: its units, fixed when it is a drink counted wrongly. */
function fixedMl(sheet: string, name: string, base: string, archetype: string, units: FileUnit[], fixes: string[][]): FileUnit[] {
  const ml = units.find((unit) => unit.name === 'millilitre');
  if (!ml || (ml.grams >= ML_PLAIN.low && ml.grams <= ML_PLAIN.high)) return units;
  const perMl = drinkGramsPerMl(name);
  if (perMl === null) {
    fixes.push([sheet, name, base, archetype, String(ml.grams), String(ml.grams), unitsText(units), unitsText(units), 'not a drink: check, not changed']);
    return units;
  }
  const fixed = units.map((unit) =>
    unit.name === 'millilitre' ? { ...unit, grams: perMl } : DRINK_VOLUMES[unit.name] !== undefined ? { ...unit, grams: oneDecimal(DRINK_VOLUMES[unit.name]! * perMl) } : unit,
  );
  const note = perMl === 1 ? 'fixed: a drink, 1.00 g per ml' : 'fixed: milk or a milk drink, 1.03 g per ml';
  fixes.push([sheet, name, base, archetype, String(ml.grams), String(perMl), unitsText(units), unitsText(fixed), note]);
  return fixed;
}

/** A unit's label: "katori" is "Katori", "plate (4 pc)" is "Plate (4 pc)", "millilitre" is "ml"; gram is Grams, no unit. */
export function unitLabel(name: string): string | null {
  if (name === 'gram') return null;
  if (name === 'millilitre') return ML_SERVING_LABEL;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** The measure a page opens on, for the file's Default Unit. */
function opensOnLabel(name: string): string {
  return name === 'gram' ? FOOD_OPENS_ON_GRAMS : unitLabel(name)!;
}

/** The units a food keeps, checked: at most 2,000 g, none named oz, each name once. */
function keptUnits(owner: string, units: readonly FileUnit[], leftOut: string[]): FoodUnit[] {
  const kept: FoodUnit[] = [];
  const names = new Set<string>();
  for (const unit of units) {
    const label = unitLabel(unit.name);
    if (label === null) continue;
    const key = label.toLowerCase();
    if (names.has(key)) continue;
    if (key === OZ_SERVING_LABEL || label.length > SERVING_LABEL_MAX || !(unit.grams > 0) || unit.grams > SERVING_GRAMS_MAX) {
      leftOut.push(`${owner}: ${unit.name} ${unit.grams} g`);
      continue;
    }
    names.add(key);
    kept.push({ label, grams: Math.round(unit.grams * 100) / 100 });
  }
  return kept;
}

/** A food's units, opening on the Default Unit when the food has it (or Grams), else as before. */
function foodUnits(units: FoodUnit[], defaultUnit: string, extraOpening: readonly string[] = []): FoodUnits {
  const opening = opensOnLabel(defaultUnit.toLowerCase());
  const known = opening === FOOD_OPENS_ON_GRAMS || extraOpening.includes(opening) || units.some((unit) => unit.label === opening);
  return { opensOn: known ? opening : null, units };
}

const DISH_COLUMNS = [
  'Base Food Item',
  'Dish Name',
  'Default Unit',
  'Allowed Units',
  'Archetype',
  'Data Source',
  'Confidence',
  'Serving Unit',
  'Serving (g/ml)',
  'Energy (kcal/100g)',
  'Protein (g/100g)',
  'Fat (g/100g)',
  'Carbs (g/100g)',
  'Fibre (g/100g)',
] as const;
const GENERIC_COLUMNS = ['Item ID', 'Food Item', 'Group', 'Default Unit', 'Allowed Units'] as const;
const PACKAGED_COLUMNS = ['Barcode', 'Default Unit', 'Allowed Units'] as const;

/** Makes the units sheet, the new estimated dishes and the ml fixes from the workbook's rows. */
export function convertFoodUnits(input: FoodUnitsInput): FoodUnitsResult {
  const report: FoodUnitsResult['report'] = {
    foods: { ifct2017: 0, indb: 0, home: 0, dish_estimate: 0, packaged: 0 },
    units: 0,
    anotherBaseAdded: [],
    anotherBaseHeld: [],
    ambiguous: 0,
    unmatched: { dishes: 0, packaged: 0, generic: 0 },
    unitsLeftOut: [],
    labelServingKept: 0,
    mlFixed: 0,
    mlNotADrink: 0,
  };
  const estimates = input.estimatesSheet.map((row) => [...row]);
  if (estimates[0]?.join(',') !== DISH_ESTIMATES_HEADER.join(',')) throw new FoodListError('The estimated-dishes sheet has another header');
  if (input.homeSheet[0]?.join(',') !== HOME_FOODS_HEADER.join(',')) throw new FoodListError('The home-foods sheet has another header');
  const est = (row: readonly string[], name: string) => row[DISH_ESTIMATES_HEADER.indexOf(name)]!;
  const hm = (row: readonly string[], name: string) => row[HOME_FOODS_HEADER.indexOf(name)]!;
  const mlFixes: string[][] = [[...ML_FIXES_HEADER]];
  const byFood = new Map<string, { food: UnitsFood | { source: 'packaged'; code: string; name: string }; units: FoodUnits }>();
  const put = (food: UnitsFood | { source: 'packaged'; code: string; name: string }, units: FoodUnits) => {
    if (units.units.length === 0 && units.opensOn === null) return;
    const key = `${food.source} ${food.code}`;
    if (!byFood.has(key)) byFood.set(key, { food, units });
  };

  // FitSphere's dishes, as D-94 matched the file's to them: INDB's recipes, the approved estimated
  // dishes (not those made here from another base food's row) and home-style foods (not the generic
  // foods D-94 made from the file).
  const estimateRows = estimates.slice(1).filter((row) => est(row, 'status') === 'approved');
  const listed: (UnitsFood & { base?: string })[] = [
    ...input.indb.map((food) => ({ source: 'indb' as const, code: food.code, name: food.name })),
    ...estimateRows
      .filter((row) => !est(row, 'data_source').endsWith(ANOTHER_BASE_NOTE))
      .map((row) => ({ source: 'dish_estimate' as const, code: est(row, 'code'), name: est(row, 'name'), base: est(row, 'base') })),
    ...input.homeSheet
      .slice(1)
      .filter((row) => hm(row, 'status') === 'approved' && !GENERIC_NOTE.test(hm(row, 'notes')))
      .map((row) => ({ source: 'home' as const, code: hm(row, 'code'), name: hm(row, 'name') })),
  ];
  const byName = new Map<string, (typeof listed)[number][]>();
  const byShortName = new Map<string, (typeof listed)[number][]>();
  const index = (map: Map<string, (typeof listed)[number][]>, key: string, food: (typeof listed)[number]) => {
    if (key === '') return;
    const foods = map.get(key) ?? [];
    if (!foods.includes(food)) foods.push(food);
    map.set(key, foods);
  };
  for (const food of listed) {
    index(byName, aliasKey(food.name), food);
    index(byShortName, aliasKey(withoutBrackets(food.name)), food);
  }

  // --- Dishes: grouped by name, as D-94 grouped them.
  const groups = new Map<string, Cell[]>();
  for (const row of columns(input.dishes, CONSOLIDATED_SHEETS.dishes, DISH_COLUMNS)) {
    const key = aliasKey(tidyName(row('Dish Name')));
    if (key === '') continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const fileUnits = new Map<Cell, FileUnit[]>();
  const unitsOf = (row: Cell, sheet: string, name: string, base: string, archetype: string) => {
    let units = fileUnits.get(row);
    if (!units) {
      units = fixedMl(sheet, name, base, archetype, readAllowedUnits(row('Allowed Units')), mlFixes);
      fileUnits.set(row, units);
    }
    return units;
  };
  const dishUnits = (row: Cell) => unitsOf(row, CONSOLIDATED_SHEETS.dishes, tidyName(row('Dish Name')), row('Base Food Item'), row('Archetype'));
  const signature = (row: Cell) => `${row('Default Unit').toLowerCase()}|${dishUnits(row).map((unit) => `${unit.name}:${unit.grams}`).join(',')}`;
  const estimateCodes = new Set(estimates.slice(1).map((row) => est(row, 'code')));
  const anotherBase = new Map(estimates.slice(1).filter((row) => est(row, 'data_source').endsWith(ANOTHER_BASE_NOTE)).map((row) => [aliasKey(est(row, 'name')), row]));

  for (const rows of groups.values()) {
    const found = byName.get(aliasKey(tidyName(rows[0]!('Dish Name')))) ?? byShortName.get(aliasKey(tidyName(rows[0]!('Dish Name')))) ?? byShortName.get(aliasKey(withoutBrackets(tidyName(rows[0]!('Dish Name')))));
    if (!found) {
      report.unmatched.dishes += rows.length;
      continue;
    }
    if (found.length > 1) {
      report.ambiguous += 1;
      continue;
    }
    const food = found[0]!;
    // R2: the row the food keeps.
    const servings = input.servings.get(`${food.source} ${food.code}`) ?? [];
    const weighsAsServing = (row: Cell) =>
      dishUnits(row).some((unit) => unit.name === row('Default Unit').toLowerCase() && servings.some((serving) => Math.abs(serving.grams - unit.grams) <= 0.5));
    const namesBase = (row: Cell) => {
      const name = ` ${aliasKey(row('Dish Name'))} `;
      return baseWords(row('Base Food Item')).some((word) => name.includes(` ${aliasKey(word)} `));
    };
    const kept =
      (food.base !== undefined ? rows.find((row) => row('Base Food Item') === food.base) : undefined) ?? rows.find(weighsAsServing) ?? rows.find(namesBase) ?? rows[0]!;
    put(food, foodUnits(keptUnits(food.name, dishUnits(kept), report.unitsLeftOut), kept('Default Unit')));

    // R2: each other base food's row with other units, as an estimated dish of its own.
    const bases = new Set([kept('Base Food Item')]);
    for (const row of rows) {
      if (row === kept || signature(row) === signature(kept) || bases.has(row('Base Food Item'))) continue;
      bases.add(row('Base Food Item'));
      const base = row('Base Food Item').slice(0, 80).trim();
      const dish = tidyName(row('Dish Name'));
      const suffix = ` (${base})`;
      const name = `${dish.slice(0, Math.max(1, 120 - suffix.length)).trim()}${suffix}`;
      const known = anotherBase.get(aliasKey(name));
      if (known) {
        // Made on an earlier run: kept as it is.
        if (est(known, 'status') === 'approved') {
          put({ source: 'dish_estimate', code: est(known, 'code'), name }, foodUnits(keptUnits(name, dishUnits(row), report.unitsLeftOut), row('Default Unit')));
          report.anotherBaseAdded.push(name);
        } else report.anotherBaseHeld.push(`${name}: ${est(known, 'issue')}`);
        continue;
      }
      let code = `est-${slug(name)}`;
      for (let n = 2; estimateCodes.has(code); n += 1) code = `est-${slug(name).slice(0, 52).replace(/-+$/, '')}-${n}`;
      const rated = /^[ABC]/i.test(row('Confidence'));
      const cells = (status: 'approved' | 'held', issue: string): string[] => {
        const values: Record<string, string> = {
          code,
          name,
          base,
          status,
          issue,
          basis: '100 g',
          kcal: twoDecimals(row('Energy (kcal/100g)')),
          protein_g: twoDecimals(row('Protein (g/100g)')),
          carbs_g: twoDecimals(row('Carbs (g/100g)')),
          fat_g: twoDecimals(row('Fat (g/100g)')),
          fibre_g: twoDecimals(row('Fibre (g/100g)')),
          serving: servingOf(row('Serving Unit')),
          serving_grams: twoDecimals(row('Serving (g/ml)')),
          search_words: baseWords(base).slice(0, 12).join('; '),
          archetype: /^[a-z0-9_]{1,40}$/.test(row('Archetype')) ? row('Archetype') : 'dish',
          confidence: rated ? 'C' : 'D',
          data_source: `${row('Data Source') || "the owner's consolidated food database"}${ANOTHER_BASE_NOTE}`,
          read_on: input.readOn,
          flag: 'llm',
        };
        return DISH_ESTIMATES_HEADER.map((column) => values[column]!);
      };
      let line = rated ? cells('approved', '') : cells('held', WEAK_MATCH_ISSUE);
      const problem = problemOf(DISH_ESTIMATES_HEADER, line, readDishEstimatesSheet);
      if (problem && rated) {
        line = cells('held', problem);
        if (problemOf(DISH_ESTIMATES_HEADER, line, readDishEstimatesSheet)) {
          report.anotherBaseHeld.push(`${name}: ${problem} (not added)`);
          continue;
        }
      } else if (problem) {
        report.anotherBaseHeld.push(`${name}: ${problem} (not added)`);
        continue;
      }
      estimateCodes.add(code);
      estimates.push(line);
      if (est(line, 'status') === 'approved') {
        report.anotherBaseAdded.push(name);
        put({ source: 'dish_estimate', code, name }, foodUnits(keptUnits(name, dishUnits(row), report.unitsLeftOut), row('Default Unit')));
      } else {
        report.anotherBaseHeld.push(`${name}: ${est(line, 'issue')}`);
      }
    }
  }

  // --- Generic unbranded: IFCT's foods by code; the file's own generic foods where D-94 put them.
  const ifct = new Map(input.ifct.map((food) => [food.code, food]));
  const everyListed = new Map<string, UnitsFood>([
    ...input.ifct.map((food): [string, UnitsFood] => [`ifct2017 ${food.code}`, { source: 'ifct2017', code: food.code, name: food.name }]),
    ...listed.map((food): [string, UnitsFood] => [`${food.source} ${food.code}`, food]),
  ]);
  const sameName = new Map<string, UnitsFood>([...everyListed.values()].map((food) => [aliasKey(food.name), food]));
  const homeByName = new Map(input.homeSheet.slice(1).filter((row) => hm(row, 'status') === 'approved').map((row) => [aliasKey(hm(row, 'name')), row]));
  for (const row of columns(input.generic, CONSOLIDATED_SHEETS.generic, GENERIC_COLUMNS)) {
    const id = row('Item ID');
    const name = row('Food Item');
    const units = () => unitsOf(row, CONSOLIDATED_SHEETS.generic, name, row('Group'), '');
    let food: UnitsFood | undefined;
    if (id.startsWith('IFCT-')) {
      const listedFood = ifct.get(id.slice('IFCT-'.length));
      if (listedFood && aliasKey(listedFood.name) === aliasKey(name)) food = { source: 'ifct2017', code: listedFood.code, name: listedFood.name };
    } else if (id.startsWith('GEN-')) {
      const same = GENERIC_SAME_AS[id];
      const home = homeByName.get(aliasKey(name.slice(0, 120)));
      food = same
        ? everyListed.get(`${same.source} ${same.code}`)
        : (sameName.get(aliasKey(name.slice(0, 120))) ?? (home ? { source: 'home', code: hm(home, 'code'), name: hm(home, 'name') } : undefined));
    }
    if (!food) {
      report.unmatched.generic += 1;
      continue;
    }
    put(food, foodUnits(keptUnits(food.name, units(), report.unitsLeftOut), row('Default Unit')));
  }

  // --- Branded packaged: by barcode; R3, the label's serving kept over the file's.
  for (const row of columns(input.packaged, CONSOLIDATED_SHEETS.packaged, PACKAGED_COLUMNS)) {
    const barcode = row('Barcode');
    if (!input.packagedServings.has(barcode)) {
      report.unmatched.packaged += 1;
      continue;
    }
    const labelServing = input.packagedServings.get(barcode) !== null;
    let units = readAllowedUnits(row('Allowed Units'));
    if (labelServing && units.some((unit) => unit.name === 'serving')) {
      report.labelServingKept += 1;
      units = units.filter((unit) => unit.name !== 'serving');
    }
    put(
      { source: 'packaged', code: barcode, name: barcode },
      foodUnits(keptUnits(barcode, units, report.unitsLeftOut), row('Default Unit'), labelServing ? [PACKAGED_SERVING_LABEL] : []),
    );
  }

  const order = (source: string) => (FOOD_UNIT_SOURCES as readonly string[]).indexOf(source);
  const rows = [...byFood.values()].sort((a, b) => order(a.food.source) - order(b.food.source) || a.food.code.localeCompare(b.food.code));
  const unitsSheet: string[][] = [[...FOOD_UNITS_HEADER]];
  for (const { food, units } of rows) {
    report.foods[food.source] += 1;
    report.units += units.units.length;
    unitsSheet.push([food.source, food.code, food.source === 'packaged' ? '' : food.name, units.opensOn ?? '', writeUnits(units.units)]);
  }
  report.mlFixed = mlFixes.slice(1).filter((row) => row[8]!.startsWith('fixed')).length;
  report.mlNotADrink = mlFixes.length - 1 - report.mlFixed;
  return { unitsSheet, estimatesSheet: estimates, mlFixes, report };
}

/** A food's units as the sheet writes them: "Katori:129 | Bowl:215 | ml:1.03". */
export function writeUnits(units: readonly FoodUnit[]): string {
  return units.map((unit) => `${unit.label}:${unit.grams}`).join(' | ');
}

/** Grams with at most two decimals, more than 0 and at most 2,000. */
const GRAMS = /^\d{1,4}(\.\d{1,2})?$/;

/**
 * Reads and checks docs/data/food-units-sheet.csv whole; any problem refuses all of it, naming the
 * line. The foods by "source code" (a packaged food's source is `packaged`, its code its barcode).
 */
export function readFoodUnitsSheet(text: string): Map<string, FoodUnits> {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== FOOD_UNITS_HEADER.join(',')) throw new FoodListError(`The food-units sheet's header must be: ${FOOD_UNITS_HEADER.join(',')}`);
  const foods = new Map<string, FoodUnits>();
  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Food-units sheet line ${index + 2}: ${problem}`);
    };
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== FOOD_UNITS_HEADER.length) fail(`expected ${FOOD_UNITS_HEADER.length} fields, found ${row.length}`);
    const [source, code, , opensOn, unitsCell] = row.map((value) => value.trim()) as [string, string, string, string, string];
    if (!(FOOD_UNIT_SOURCES as readonly string[]).includes(source)) fail(`source must be one of ${FOOD_UNIT_SOURCES.join(', ')}`);
    if (code === '' || code.length > 64) fail('code must be given, at most 64 characters');
    const key = `${source} ${code}`;
    if (foods.has(key)) fail(`${source} ${code} appears twice`);
    const units: FoodUnit[] = [];
    for (const part of unitsCell === '' ? [] : unitsCell.split('|')) {
      const at = part.lastIndexOf(':');
      const label = part.slice(0, at).trim();
      const grams = part.slice(at + 1).trim();
      if (at < 0 || label === '' || label.length > SERVING_LABEL_MAX) fail(`"${part.trim()}" must be a unit's name, at most ${SERVING_LABEL_MAX} characters, then :grams`);
      if (label.toLowerCase() === OZ_SERVING_LABEL) fail('no unit may be named oz, the weight every food may be logged in (D-76)');
      if (!GRAMS.test(grams) || Number(grams) <= 0 || Number(grams) > SERVING_GRAMS_MAX) fail(`${label}: grams must be more than 0 and at most 2,000, with two decimals`);
      if (units.some((unit) => unit.label.toLowerCase() === label.toLowerCase())) fail(`${label} appears twice`);
      units.push({ label, grams: Number(grams) });
    }
    if (opensOn.length > SERVING_LABEL_MAX) fail('opens_on is too long');
    if (units.length === 0 && opensOn === '') fail('a row gives units or the unit its page opens on');
    foods.set(key, { opensOn: opensOn === '' ? null : opensOn, units });
  });
  return foods;
}

/**
 * A packaged food with the sheet's units and the measure its page opens on (D-102): a unit named as the
 * label's serving is left out when the label gives one (R3), and the page opens only on a measure the
 * food has (a unit, the label's Serving, or Grams).
 */
export function withPackagedUnits<T extends { servingGrams: number | null }>(food: T, units: FoodUnits | undefined): T & { portions?: FoodUnit[]; opensOn?: string } {
  if (!units) return food;
  const labelServing = food.servingGrams !== null;
  const portions = units.units.filter((unit) => !(labelServing && unit.label.toLowerCase() === PACKAGED_SERVING_LABEL.toLowerCase()));
  const names = [...portions.map((unit) => unit.label), ...(labelServing ? [PACKAGED_SERVING_LABEL] : [])];
  const opensOn =
    units.opensOn === null ? undefined : units.opensOn === FOOD_OPENS_ON_GRAMS ? FOOD_OPENS_ON_GRAMS : names.find((name) => name.toLowerCase() === units.opensOn!.toLowerCase());
  return { ...food, ...(portions.length > 0 ? { portions } : {}), ...(opensOn !== undefined ? { opensOn } : {}) };
}

/** The units of one source's foods, by code. */
export function unitsOfSource(sheet: ReadonlyMap<string, FoodUnits>, source: FoodUnitSource): Map<string, FoodUnits> {
  const prefix = `${source} `;
  return new Map([...sheet].filter(([key]) => key.startsWith(prefix)).map(([key, units]) => [key.slice(prefix.length), units]));
}

/**
 * A source's servings with the sheet's units (D-102): a unit the food already has by that name (in any
 * case) takes the sheet's grams (R1, "keep the sheet value"); the others come after the food's own,
 * numbered on. Foods the sheet does not give stay as they are.
 */
export function withSheetUnits(portions: readonly ImportedPortion[], units: ReadonlyMap<string, FoodUnits>): { portions: ImportedPortion[]; replaced: number; added: number } {
  const byFood = new Map<string, ImportedPortion[]>();
  for (const portion of portions) byFood.set(portion.code, [...(byFood.get(portion.code) ?? []), { ...portion }]);
  let replaced = 0;
  let added = 0;
  for (const [code, { units: list }] of units) {
    const own = byFood.get(code) ?? [];
    let seq = own.reduce((most, portion) => Math.max(most, portion.seq), 0);
    for (const unit of list) {
      const same = own.find((portion) => portion.label.toLowerCase() === unit.label.toLowerCase());
      if (same) {
        if (same.grams !== unit.grams) replaced += 1;
        same.grams = unit.grams;
        continue;
      }
      seq += 1;
      own.push({ code, seq, label: unit.label, grams: unit.grams });
      added += 1;
    }
    if (own.length > 0) byFood.set(code, own);
  }
  return { portions: [...byFood.values()].flat(), replaced, added };
}

/**
 * The measure each food's page opens on, by code: only one the food has, as the food names it (a
 * serving of `portions`, one of `extra`, or Grams); a food without one opens as before.
 */
export function opensOnOf(portions: readonly ImportedPortion[], units: ReadonlyMap<string, FoodUnits>, extra: (code: string) => readonly string[] = () => []): Map<string, string> {
  const labels = new Map<string, string[]>();
  for (const portion of portions) labels.set(portion.code, [...(labels.get(portion.code) ?? []), portion.label]);
  const opens = new Map<string, string>();
  for (const [code, { opensOn }] of units) {
    if (opensOn === null) continue;
    if (opensOn === FOOD_OPENS_ON_GRAMS) {
      opens.set(code, opensOn);
      continue;
    }
    const label = [...(labels.get(code) ?? []), ...extra(code)].find((name) => name.toLowerCase() === opensOn.toLowerCase());
    if (label !== undefined) opens.set(code, label);
  }
  return opens;
}
