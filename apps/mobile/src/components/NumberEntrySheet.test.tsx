import { fireEvent, render, screen } from '@testing-library/react-native';
import { LIGHT_COLORS } from '../theme';
import { NumberEntrySheet } from './NumberEntrySheet';

// The redesign's 2.4 (locked by the owner, 2026-11-03); what each value saves is tested with Home.
describe('REQ-HOME-006 the entry sheet', () => {
  it('a value that cannot be saved turns the outline red and names the rule under it, and nothing is saved', async () => {
    const onSave = jest.fn();
    await render(
      <NumberEntrySheet
        title="Steps · Tue 3 Nov"
        label="Steps"
        unit="steps"
        initialText="120000"
        parse={() => null}
        rule="Enter whole steps from 0 to 100,000."
        decimal={false}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter whole steps from 0 to 100,000.');
    expect(screen.getByLabelText('Steps').parent).toHaveStyle({ borderColor: LIGHT_COLORS.danger });
    expect(onSave).not.toHaveBeenCalled();
  });
});
