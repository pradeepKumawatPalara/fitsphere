import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { FoodListError } from './ifct.ts';
import { readXlsxRows } from './xlsx.ts';

// The small .xlsx reader INDB's file is read with (D-46). A workbook is built here as a zip, one entry
// stored and one deflated, as Excel writes them; the CRCs are not checked by the reader.

function zip(files: Record<string, { text: string; deflate: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [name, { text, deflate }] of Object.entries(files)) {
    const raw = Buffer.from(text, 'utf8');
    const data = deflate ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(deflate ? 8 : 0, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    directory.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = directory.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...directory, end]);
}

const SHARED = `<?xml version="1.0"?><sst xmlns="x"><si><t>food_name</t></si><si><t xml:space="preserve">Dal &amp; rice (Dal chawal)</t></si><si><r><t>Bo</t></r><r><t>wl</t></r></si></sst>`;
const SHEET = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>energy_kcal</t></is></c><c r="D1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" s="3"><v>1.5E2</v></c><c r="C2"/><c r="D2"><f>B2*2</f><v>300</v></c></row>
<row r="3"/>
</sheetData></worksheet>`;

describe('D-46 reading an .xlsx sheet', () => {
  it('reads shared strings, inline strings, numbers and formulas’ values, with empty cells as ""', () => {
    const workbook = zip({
      'xl/sharedStrings.xml': { text: SHARED, deflate: false },
      'xl/worksheets/sheet1.xml': { text: SHEET, deflate: true },
    });

    expect(readXlsxRows(workbook)).toEqual([['food_name', 'energy_kcal', '', 'Bowl'], ['Dal & rice (Dal chawal)', '1.5E2', '', '300'], []]);
  });

  it('D-81 reads a sheet by its name, through the workbook and its links', () => {
    const workbook = zip({
      'xl/workbook.xml': {
        text: `<workbook><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="All &amp; more" sheetId="2" r:id="rId2"/></sheets></workbook>`,
        deflate: false,
      },
      'xl/_rels/workbook.xml.rels': {
        text: `<Relationships><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
        deflate: true,
      },
      'xl/sharedStrings.xml': { text: SHARED, deflate: false },
      'xl/worksheets/sheet1.xml': { text: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>2</v></c></row></sheetData></worksheet>', deflate: false },
      'xl/worksheets/sheet2.xml': { text: SHEET, deflate: true },
    });

    expect(readXlsxRows(workbook)).toEqual([['Bowl']]);
    expect(readXlsxRows(workbook, 'All & more')[1]).toEqual(['Dal & rice (Dal chawal)', '1.5E2', '', '300']);
    expect(() => readXlsxRows(workbook, 'Barbell')).toThrow('no sheet named "Barbell"');
  });

  it('refuses a file that is not a workbook', () => {
    expect(() => readXlsxRows(Buffer.from('food_code,name\n'))).toThrow(FoodListError);
    expect(() => readXlsxRows(zip({ 'xl/workbook.xml': { text: '<workbook/>', deflate: false } }))).toThrow('no first sheet');
  });
});
