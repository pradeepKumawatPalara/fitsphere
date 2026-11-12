// docs/data/everyday-foods-sheet.csv (D-92): for an everyday word ("rice", "dal", "chai"), the food Search
// foods lists first, as the owner chooses it row by row: the food as eaten ("Boiled rice (Uble chawal)"),
// where the word alone finds raw rice, dry packs or premixes first. `foods:import` puts the approved rows
// among the food's other names as the word marked with "@" ("@rice"), which the phone reads to list it
// first and finds it by ("tea" finds "Masala Chai"). Other names are never shown. `proposed` rows wait.
import { parseCsv } from './csv.ts';
import { DISH_ESTIMATE_SOURCE } from './dishEstimates.ts';
import { HOME_FOOD_SOURCE } from './homeFoods.ts';
import { FoodListError, IFCT_SOURCE, type ImportedFood } from './ifct.ts';
import { INDB_SOURCE } from './indb.ts';

export const EVERYDAY_FOODS_HEADER: readonly string[] = ['word', 'source', 'code', 'name', 'kcal', 'status', 'reason'];

/** The sources an everyday food comes from: foods as eaten or measured, never a brand's. */
export const EVERYDAY_SOURCES: readonly string[] = [IFCT_SOURCE, INDB_SOURCE, HOME_FOOD_SOURCE, DISH_ESTIMATE_SOURCE];

/** The mark an everyday word carries among a food's other names; the phone's EVERYDAY_MARK. */
export const EVERYDAY_MARK = '@';

export type EverydayFood = { word: string; source: string; code: string; name: string; approved: boolean };

/** A word as a search reads it: lowercase, without accents, letters and digits only, one space between words. */
export const everydayWord = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Parses and checks the whole sheet; any problem refuses all of it, naming the line. */
export function readEverydayFoods(text: string): EverydayFood[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== EVERYDAY_FOODS_HEADER.join(',')) throw new FoodListError(`The everyday foods' header must be: ${EVERYDAY_FOODS_HEADER.join(',')}`);
  const seen = new Set<string>();
  return rows.map((row, index): EverydayFood => {
    const line = `Everyday foods, line ${index + 2}`;
    if (row.length !== EVERYDAY_FOODS_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    const [word = '', source = '', code = '', name = '', kcal = '', status = '', reason = ''] = row.map((cell) => cell.trim());
    if (!word || word !== everydayWord(word)) throw new FoodListError(`${line}: the word must be lowercase letters and digits, as a search reads it`);
    if (!EVERYDAY_SOURCES.includes(source)) throw new FoodListError(`${line}: the source must be one of ${EVERYDAY_SOURCES.join(', ')}`);
    if (!code || !name) throw new FoodListError(`${line}: the code and the name must be given`);
    if (!/^\d+(\.\d+)?$/.test(kcal)) throw new FoodListError(`${line}: the kcal must be a number`);
    if (status !== 'proposed' && status !== 'approved') throw new FoodListError(`${line}: the status must be proposed or approved`);
    if (!reason) throw new FoodListError(`${line}: the reason must be given`);
    const key = `${word}|${source}|${code}`;
    if (seen.has(key)) throw new FoodListError(`${line}: the word and the food appear twice`);
    seen.add(key);
    return { word, source, code, name, approved: status === 'approved' };
  });
}

/**
 * One source's foods with the approved everyday words marked among their other names (D-92). A row
 * whose food is not listed, or is hidden, is counted and left out; one whose food has another name
 * now refuses the import, so the sheet is checked again.
 */
export function withEverydayWords(
  foods: readonly ImportedFood[],
  source: string,
  everyday: readonly EverydayFood[],
): { foods: ImportedFood[]; marked: number; missing: number } {
  const byCode = new Map<string, string[]>();
  let missing = 0;
  const listed = new Map(foods.map((food) => [food.code, food]));
  for (const row of everyday) {
    if (!row.approved || row.source !== source) continue;
    const food = listed.get(row.code);
    if (!food || food.hidden) {
      missing += 1;
      continue;
    }
    if (food.name !== row.name) throw new FoodListError(`Everyday foods: ${source} ${row.code} is now named "${food.name}", not "${row.name}"`);
    byCode.set(row.code, [...(byCode.get(row.code) ?? []), `${EVERYDAY_MARK}${row.word}`]);
  }
  let marked = 0;
  const result = foods.map((food): ImportedFood => {
    const words = byCode.get(food.code)?.filter((word) => !food.aliases.includes(word));
    if (!words?.length) return food;
    marked += words.length;
    return { ...food, aliases: [...food.aliases, ...words] };
  });
  return { foods: result, marked, missing };
}
