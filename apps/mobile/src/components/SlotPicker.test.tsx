import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SlotPicker } from './MealSheets';

// The phone's text size, as Android's font size and display size settings give it.
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

// The meal choice (REQ-LOG-003): in Log meal always four across, as tiles with icons, a name too long
// for its quarter shrinking to fit (D-58, the owner's "3.5 Log meal in steps"); re-logging a saved
// meal (3.2) two by two.
function lines() {
  return [0, 1]
    .map((index) => screen.queryByTestId(`slot-line-${index}`))
    .filter((line) => line !== null)
    .map((line) => within(line).getAllByRole('radio').map((radio) => radio.props.accessibilityLabel as string));
}

async function layOut(width: number) {
  await fireEvent(screen.getByTestId('slot-picker'), 'layout', { nativeEvent: { layout: { width } } });
}

const TWO_BY_TWO = [
  ['Breakfast', 'Lunch'],
  ['Snack', 'Dinner'],
];

beforeEach(() => {
  mockFontScale = 1;
});

describe('REQ-LOG-003 the meal choice', () => {
  it('four across on a phone 390 wide', async () => {
    await render(<SlotPicker value="lunch" onChange={jest.fn()} />);
    await layOut(358);
    expect(lines()).toEqual([['Breakfast', 'Lunch', 'Snack', 'Dinner']]);
    expect(screen.getByRole('radio', { name: 'Lunch' })).toBeChecked();
  });

  it('still four across with larger text or on a narrow screen, each name shrinking to fit (D-58)', async () => {
    mockFontScale = 1.3;
    await render(<SlotPicker value={null} onChange={jest.fn()} />);
    await layOut(248);
    expect(lines()).toEqual([['Breakfast', 'Lunch', 'Snack', 'Dinner']]);
    expect(screen.getByText('Breakfast').props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(screen.getAllByRole('radio').every((radio) => !radio.props.accessibilityState.checked)).toBe(true);
  });

  it('the chosen meal is filled in caramel, and choosing another tells which (D-58)', async () => {
    const onChange = jest.fn();
    await render(<SlotPicker value="breakfast" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Breakfast' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Breakfast' })).toHaveStyle({ backgroundColor: '#B58863' });
    expect(screen.getByRole('radio', { name: 'Dinner' })).not.toHaveStyle({ backgroundColor: '#B58863' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    expect(onChange).toHaveBeenCalledWith('dinner');
  });

  it('re-logging a saved meal is always two by two', async () => {
    const onChange = jest.fn();
    await render(<SlotPicker value="snack" onChange={onChange} twoByTwo />);
    await layOut(358);
    expect(lines()).toEqual(TWO_BY_TWO);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    expect(onChange).toHaveBeenCalledWith('dinner');
  });
});
