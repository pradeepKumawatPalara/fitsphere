// Reads the first sheet of an Excel workbook (.xlsx) as rows of text, with Node's own zlib: enough
// for INDB's files (D-46), so no spreadsheet library is added. An .xlsx is a zip of XML files; this
// reads the zip's directory, its stored or deflated entries, the shared strings and the sheet's
// cells (shared strings, inline strings and numbers; a formula gives its saved value). Zip64 and
// encrypted workbooks are not read.
import { inflateRawSync } from 'node:zlib';
import { FoodListError } from './ifct.ts';

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;

/** The zip's files by name, unpacked. */
function unzip(zip: Buffer): Map<string, Buffer> {
  let end = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at -= 1) {
    if (zip.readUInt32LE(at) === END_OF_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new FoodListError('Not an .xlsx file: no zip directory');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let entry = 0; entry < count; entry += 1) {
    if (zip.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new FoodListError('The .xlsx file is damaged');
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    if (zip.readUInt32LE(local) !== LOCAL_ENTRY) throw new FoodListError('The .xlsx file is damaged');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new FoodListError(`The .xlsx file packs ${name} in a way not read here`);
    files.set(name, method === 0 ? data : inflateRawSync(data));
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return files;
}

/** XML text with its five named entities and numeric references decoded. */
function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
    return named[entity.toLowerCase()] ?? '';
  });
}

/** The text of every <t> inside an XML fragment, joined. */
function texts(fragment: string): string {
  return [...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1] ?? '')).join('');
}

/** A cell's column from its reference: "A1" is 0, "AB7" is 27. */
function column(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? '';
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

/** The first sheet's rows, each as long as its last filled cell; an empty cell is "". */
export function readXlsxRows(workbook: Buffer): string[][] {
  const files = unzip(workbook);
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new FoodListError('The .xlsx file has no first sheet');
  const sharedXml = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => texts(match[1] ?? ''));
  const rows: string[][] = [];
  for (const rowMatch of sheet.toString('utf8').matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1] ?? '';
      const body = cell[2] ?? '';
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? '';
      const type = /\bt="(\w+)"/.exec(attributes)?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const text =
        type === 's' ? (shared[Number(value)] ?? '') : type === 'inlineStr' ? texts(body) : value === undefined ? '' : decode(value);
      const at = reference ? column(reference) : row.length;
      while (row.length < at) row.push('');
      row[at] = text;
    }
    rows.push(row);
  }
  return rows;
}
