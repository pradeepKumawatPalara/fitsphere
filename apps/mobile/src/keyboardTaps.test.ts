// A tap while the keyboard is open must reach the button tapped (the owner's phone test, 2026-11-04:
// Save in the steps sheet took two taps, the first only closing the keyboard). A scrolling list
// takes such a tap for itself, to close the keyboard, unless it lets taps through with
// keyboardShouldPersistTaps="handled". A sheet opens inside its screen's list, and the tap reaches
// that list too, so every list in the app lets taps through. This guard checks each one.

// Node's file functions, typed here as memoryDb does, since the app's types leave Node out.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
}>('node:fs');
const { join, relative } = jest.requireActual<{ join(...parts: string[]): string; relative(from: string, to: string): string }>(
  'node:path',
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Each opening tag of a scrolling list in `text`, up to its closing `>` outside any `{…}`. */
function listTags(text: string): string[] {
  const tags: string[] = [];
  for (const match of text.matchAll(/<(ScrollView|FlatList|SectionList)\b/g)) {
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    tags.push(text.slice(match.index, end + 1));
  }
  return tags;
}

describe('a tap while the keyboard is open reaches its button', () => {
  it('every scrolling list lets taps through (keyboardShouldPersistTaps="handled")', () => {
    const files = sourceFiles(__dirname);
    const lists = files.flatMap((file) => listTags(readFileSync(file, 'utf8')).map((tag) => ({ file: relative(__dirname, file), tag })));

    expect(lists.length).toBeGreaterThan(10);
    expect(lists.filter(({ tag }) => !tag.includes('keyboardShouldPersistTaps="handled"')).map(({ file, tag }) => `${file}: ${tag.split('\n')[0]}`)).toEqual([]);
  });
});
