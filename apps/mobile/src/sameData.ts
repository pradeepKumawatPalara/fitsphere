/**
 * Whether two values read from the phone hold the same data. Plain data only (what the phone's database
 * gives): read twice by the same code, the same data has its keys in the same order. A value read
 * again after a save or sync keeps the one already shown when it is the same, so nothing that shows
 * it draws again (REQ-NFR-003).
 */
export function sameData(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
