import { useEffect, useState } from 'react';

/** How long typing must pause before a field's problem shows: three seconds (D-99, the owner's choice). */
export const CHECK_PAUSE_MS = 3_000;

let pauseMs = CHECK_PAUSE_MS;

/**
 * Tests only: how long to wait. 0 shows a problem as soon as it is typed, which most tests use; the
 * tests of the wait set a short pause.
 */
export function setCheckPause(ms: number): void {
  pauseMs = ms;
}

/**
 * When the problems of a form's fields may show (D-99; the owner, 2026-11-13: "all the validations
 * should shows when the User stop typing just after 5 second ... not on when the user click on the
 * button"; then "lets change it to 3 seconds"). A field's problem shows once typing in it has paused
 * for three seconds, or as soon as the field is left; an empty field's ("Enter …") only once the field
 * has been left empty. The screen works each problem out from what is typed now, so a problem goes the
 * moment the field is put right. No problem waits for a button: the screen greys its button while there
 * is one.
 *
 * `values` holds each field's text, by a name the screen chooses.
 */
export function useFieldChecks(values: Readonly<Record<string, string>>): FieldChecks {
  const [settled, setSettled] = useState(values);
  const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set());
  const [focused, setFocused] = useState<string | null>(null);
  // What is typed, as one text, so the pause starts again only when something changes.
  const typed = JSON.stringify(values);

  useEffect(() => {
    if (pauseMs === 0) return;
    const timer = setTimeout(() => setSettled(JSON.parse(typed) as Record<string, string>), pauseMs);
    return () => clearTimeout(timer);
  }, [typed]);

  const isSettled = (name: string) => pauseMs === 0 || (values[name] ?? '') === (settled[name] ?? '');
  return {
    focused,
    isSettled,
    wasLeft: (name) => left.has(name),
    shows: (name) => isSettled(name) && ((values[name] ?? '').trim() !== '' || left.has(name)),
    focus: (name) => setFocused(name),
    blur: (name) => {
      setFocused((current) => (current === name ? null : current));
      setLeft((current) => (current.has(name) ? current : new Set(current).add(name)));
      // What the field holds counts at once.
      setSettled(values);
    },
  };
}

export type FieldChecks = {
  /** The field being typed in, if any. */
  focused: string | null;
  /** Typing in the field has paused (or it was left) since it last changed. */
  isSettled(name: string): boolean;
  /** The field has been typed in and left. */
  wasLeft(name: string): boolean;
  /** A problem with this field may show: it is settled, and it holds something or has been left. */
  shows(name: string): boolean;
  /** For the field's onFocus. */
  focus(name: string): void;
  /** For the field's onBlur. */
  blur(name: string): void;
};
