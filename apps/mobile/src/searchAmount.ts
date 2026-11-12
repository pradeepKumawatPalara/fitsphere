// An amount typed with a food in Search foods (D-96; QA-18 of the search QA report): "2 roti", "1 cup
// rice", "half plate biryani", "100g paneer", "amul ghee 1 litre tin". The amount, its measure, the
// size and pack words after it, and words like "of", "with" and "and" are left out of the search, so
// it finds the food ("roti"); the food's page then opens on the amount when the food has that measure.
// A search naming several foods ("chicken biryani with raita and salad") gives each of them, for the
// search to offer when no food has every word.

/** An amount read from a search: so many of a measure ("cup", "plate"), or grams ("g"); `unit` null for a bare count. */
export type SearchAmount = { count: number; unit: string | null };

export type ReadSearch = {
  /** The words to search for; empty when the search is only an amount, and is then searched as typed. */
  search: string;
  amount: SearchAmount | null;
  /** The foods a search joining several with "with", "and", "&", "+" or a comma names, as typed; else none. */
  foods: string[];
};

const NUMBER_WORDS: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** Counted only before a measure ("half plate"): "half fry" and "half boiled" are ways of cooking. */
const HALF_WORDS: Readonly<Record<string, number>> = { half: 0.5, aadha: 0.5, adha: 0.5, quarter: 0.25 };
/** Grams in one of each weight or volume word (a millilitre taken as a gram, as the food list does). */
const WEIGHTS: Readonly<Record<string, number>> = {
  g: 1, gm: 1, gms: 1, gr: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000,
  ml: 1, mls: 1,
  l: 1000, ltr: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
};
/** The measures a page may count, as one word each. */
const MEASURES: Readonly<Record<string, string>> = {
  cup: 'cup', cups: 'cup', mug: 'mug', mugs: 'mug',
  katori: 'katori', katoris: 'katori', bowl: 'bowl', bowls: 'bowl',
  plate: 'plate', plates: 'plate', glass: 'glass', glasses: 'glass',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', nos: 'piece',
  slice: 'slice', slices: 'slice',
  teaspoon: 'teaspoon', teaspoons: 'teaspoon', tsp: 'teaspoon',
  tablespoon: 'tablespoon', tablespoons: 'tablespoon', tbsp: 'tablespoon',
  spoon: 'spoon', spoons: 'spoon',
  serving: 'serving', servings: 'serving', scoop: 'scoop', scoops: 'scoop', handful: 'handful', handfuls: 'handful',
};
const SIZES: ReadonlySet<string> = new Set(['small', 'medium', 'large', 'big', 'regular']);
const PACKS: ReadonlySet<string> = new Set(['pack', 'packs', 'packet', 'packets', 'pouch', 'pouches', 'tin', 'tins', 'bottle', 'bottles', 'jar', 'jars', 'box', 'boxes', 'can', 'cans', 'sachet', 'sachets']);
/** Words that join foods in a search. */
const JOINERS: ReadonlySet<string> = new Set(['with', 'and', 'plus', '&', '+', ',']);
/** Words left out of the search wherever they are. */
const FILLER: ReadonlySet<string> = new Set([...JOINERS, 'of', 'the', 'a', 'an', 'some']);

/**
 * The words of a search, lowercase: fractions as decimals, a comma and a number stuck to its unit apart.
 * A + or & inside a word stays in it ("m&m's", "aloo+gobi": D-86 reads them as one).
 */
function tokensOf(query: string): string[] {
  const text = query
    .toLowerCase()
    .replace(/(\d)\s*½/g, '$1.5')
    .replace(/(\d)\s*¼/g, '$1.25')
    .replace(/(\d)\s*¾/g, '$1.75')
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    .replace(/,/g, ' , ');
  return text.split(/\s+/).flatMap((token) => {
    const stuck = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(token);
    return stuck && (stuck[2]! in WEIGHTS || stuck[2]! in MEASURES || PACKS.has(stuck[2]!)) ? [stuck[1]!, stuck[2]!] : token === '' ? [] : [token];
  });
}

/** A number typed: digits, a fraction, or a word ("two"); null when it is none. */
function numberOf(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  const fraction = /^(\d+)\/(\d+)$/.exec(token);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);
  return NUMBER_WORDS[token] ?? null;
}

const isUnit = (token: string | undefined) => token !== undefined && (token in WEIGHTS || token in MEASURES);

/** The search's words, amount and foods (D-96). */
export function readSearch(query: string): ReadSearch {
  const tokens = tokensOf(query);
  const { words, amount } = read(tokens);
  // The foods: the search split where a joining word is, each part as typed, amount and all.
  const parts: string[][] = [[]];
  for (const token of tokens) {
    if (JOINERS.has(token)) parts.push([]);
    else parts[parts.length - 1]!.push(token);
  }
  const foods = parts.filter((part) => read(part).words.length > 0).map((part) => part.join(' '));
  return { search: words.join(' '), amount, foods: foods.length > 1 ? foods : [] };
}

/** The words to search for, and the amount, of a search's words. */
function read(tokens: readonly string[]): { words: string[]; amount: SearchAmount | null } {
  let amount: SearchAmount | null = null;
  const kept: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (amount === null) {
      let count: number | null = null;
      let at = index + 1;
      const number = numberOf(token);
      // A number is an amount first in the search or before a measure, size or pack ("chicken 65" is a dish).
      if (number !== null && (index === 0 || isUnit(next) || SIZES.has(next ?? '') || PACKS.has(next ?? ''))) count = number;
      else if (token in HALF_WORDS && isUnit(next)) count = HALF_WORDS[token]!;
      else if (token in HALF_WORDS && (next === 'a' || next === 'an') && isUnit(tokens[index + 2])) {
        count = HALF_WORDS[token]!;
        at += 1;
      } else if ((token === 'a' || token === 'an') && isUnit(next)) count = 1;
      if (count !== null) {
        let unit: string | null = null;
        while (SIZES.has(tokens[at] ?? '')) at += 1;
        const word = tokens[at];
        if (word !== undefined && word in WEIGHTS) {
          count *= WEIGHTS[word]!;
          unit = 'g';
          at += 1;
        } else if (word !== undefined && word in MEASURES) {
          unit = MEASURES[word]!;
          at += 1;
        }
        while (PACKS.has(tokens[at] ?? '')) at += 1;
        if (tokens[at] === 'of') at += 1;
        amount = { count, unit };
        index = at - 1;
        continue;
      }
    }
    kept.push(token);
  }
  return { words: kept.filter((token) => !FILLER.has(token)), amount };
}

/** A measure's name as one word, to compare with a typed measure: "Plate (4 pc)" plate, "Katori (200 ml)" katori, "Slices" slice. */
export function measureWord(name: string): string {
  const word = name.toLowerCase().match(/[a-z]+/)?.[0] ?? '';
  return MEASURES[word] ?? (word in WEIGHTS ? 'g' : word);
}

/** Whether a food's name has the amount's number as a word of its own: "5 Star", "2 Minute Noodles" (not an amount then). */
export function nameHasNumber(name: string, amount: SearchAmount): boolean {
  return amount.unit === null && new RegExp(`(^|[^0-9.])${String(amount.count).replace('.', '\\.')}([^0-9.]|$)`).test(name);
}
