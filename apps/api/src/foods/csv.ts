// A small CSV reader (RFC 4180): fields separated by commas; a field in double quotes may hold
// commas, line breaks and doubled quotes ("" for "). LF and CRLF line endings both work; a
// byte-order mark is skipped and a final line break adds no row. No dependency is needed for the
// one file the API reads (data/foods/ifct2017-foods.csv).

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

export function parseCsv(text: string): string[][] {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          const next = source[index + 1];
          if (next !== undefined && next !== ',' && next !== '\n' && next !== '\r') {
            throw new CsvError(`Line ${line}: text after a closing quote`);
          }
        }
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"') {
      if (field !== '') throw new CsvError(`Line ${line}: a quote inside an unquoted field`);
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      line += 1;
    } else {
      field += char;
    }
  }
  if (quoted) throw new CsvError(`Line ${line}: a quoted field is not closed`);
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV text for rows: a field with a comma, quote or line break is quoted, quotes doubled; LF lines. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const field = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return rows.map((row) => row.map(field).join(',')).join('\n') + '\n';
}
