import { fireEvent, screen, within } from '@testing-library/react-native';

/**
 * Chooses an amount on a food's page (D-45): opens the picker from the Quantity box (or, when grams
 * are typed, the Measure box), takes the measure, then the quantity, and presses Done.
 */
export async function pickAmount({ measure, quantity }: { measure?: string; quantity?: string }) {
  await fireEvent.press(screen.queryByRole('button', { name: /^Quantity: / }) ?? screen.getByRole('button', { name: /^Measure: / }));
  if (measure !== undefined) await fireEvent.press(within(screen.getByLabelText('Measure')).getByRole('button', { name: measure }));
  if (quantity !== undefined) await fireEvent.press(within(screen.getByLabelText('Quantity')).getByRole('button', { name: quantity }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
}

/** What the open picker's wheel offers, top to bottom. */
export function wheel(label: 'Quantity' | 'Measure'): string[] {
  return within(screen.getByLabelText(label))
    .getAllByRole('button')
    .map((row) => String(row.props.accessibilityLabel));
}

/** The four nutrients the page shows, in order, as read out. */
export function nutrients(): string[] {
  return ['Protein', 'Carbs', 'Fat', 'Fibre'].map((name) => String(screen.getByLabelText(new RegExp(`^${name}: `)).props.accessibilityLabel));
}
