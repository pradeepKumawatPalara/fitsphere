import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { SlotPicker } from './MealSheets';

// The phone's text size, as Android's font size and display size settings give it.
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

// The meal choice (REQ-LOG-003; the redesign's 3.5 and 3.2): four across when "BREAKFAST" fits a
// quarter of the row, otherwise two by two, each line a row of its own so none runs off the screen.
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

  it('two by two, in two rows, with larger text or on a narrow screen', async () => {
    mockFontScale = 1.3;
    await render(<SlotPicker value={null} onChange={jest.fn()} />);
    await layOut(358);
    expect(lines()).toEqual(TWO_BY_TWO);

    mockFontScale = 1;
    await layOut(248);
    expect(lines()).toEqual(TWO_BY_TWO);
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
