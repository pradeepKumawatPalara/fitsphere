import { fireEvent, render, screen } from '@testing-library/react-native';
import { setCheckPause } from '../fieldChecks';
import { LIGHT_COLORS } from '../theme';
import { NumberEntrySheet } from './NumberEntrySheet';

// The redesign's 2.4 (locked by the owner, 2026-11-03); what each value saves is tested with Home.
// D-99: the rule shows once typing pauses or the box is left, never because Save was pressed.
const RULE = 'Enter whole steps from 0 to 200,000.';

async function renderSheet(onSave = jest.fn()) {
  await render(
    <NumberEntrySheet
      title="Steps · Tue 3 Nov"
      label="Steps"
      unit="steps"
      initialText=""
      parse={(text) => (text === '5000' ? 5_000 : null)}
      rule={RULE}
      decimal={false}
      onSave={onSave}
      onClose={jest.fn()}
    />,
  );
  return onSave;
}

describe('REQ-HOME-006 the entry sheet', () => {
  it('D-99 a value that cannot be saved names the rule once typing pauses, the outline red; Save waits and nothing is saved', async () => {
    // A short pause in place of the three seconds.
    setCheckPause(300);
    const onSave = await renderSheet();

    await fireEvent.changeText(screen.getByLabelText('Steps'), '120000');
    // Not while typing: once typing pauses.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await screen.findByRole('alert')).toHaveTextContent(RULE);
    expect(screen.getByLabelText('Steps').parent).toHaveStyle({ borderColor: LIGHT_COLORS.danger });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();

    // Put right, the rule goes at once, and Save can be pressed.
    await fireEvent.changeText(screen.getByLabelText('Steps'), '5000');
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(5_000);
  });

  it('D-99 the rule shows at once when the box is left', async () => {
    await renderSheet();

    await fireEvent.changeText(screen.getByLabelText('Steps'), 'abc');
    await fireEvent(screen.getByLabelText('Steps'), 'blur');

    expect(screen.getByRole('alert')).toHaveTextContent(RULE);
  });

  it('D-99 an empty box greys Save, saying nothing until it is left empty', async () => {
    await renderSheet();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent(screen.getByLabelText('Steps'), 'blur');

    expect(screen.getByRole('alert')).toHaveTextContent(RULE);
  });
});
