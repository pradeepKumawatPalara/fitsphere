import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { Bookmark, Plus, Trash } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../meals';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Sheet, SheetHeading } from './Sheet';
import { Field, Text, TextButton, useChoiceStyles } from './ui';

// Bottom sheets for the meal menus (REQ-NUT-004, REQ-SAVED-001): a list of actions, a
// confirmation, a name, and re-logging a saved meal. The redesign's 3.2 (locked by the owner,
// 2026-11-03): the confirmation, the name and re-logging open with a tile over the title.

export function ActionsSheet({
  title,
  actions,
  onClose,
  children,
}: {
  title: string;
  /** `destructive`: deletes or removes something, so it shows in the "over" red. */
  actions: { label: string; onPress(): void; destructive?: boolean }[];
  onClose(): void;
  /** Shown above the actions, e.g. a field an action uses. */
  children?: ReactNode;
}) {
  const styles = useStyles();
  // The actions are a menu: full-width rows in a panel, ruled between them.
  return (
    <Sheet title={title} onClose={onClose} actions={<TextButton title="Cancel" wide onPress={onClose} />}>
      {children}
      {actions.length > 0 ? (
        <View style={styles.menu}>
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.menuRow, index > 0 && styles.ruled, pressed && styles.pressed]}
            >
              <Text style={[styles.menuText, action.destructive && styles.destructiveText]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * Asks before something that cannot be undone, such as deleting a meal (MVP default, D-26), with an
 * optional `message` under the title and the way out's label (Cancel, or Keep).
 */
export function ConfirmSheet({
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
}) {
  const styles = useStyles();
  // As every confirmation: the way out on the left, the action in red on the right, the same size.
  return (
    <Sheet
      header={<SheetHeading icon={Trash} title={title} danger />}
      onClose={onClose}
      actions={
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextButton title={cancelLabel} outlined wide onPress={onClose} />
          </View>
          <View style={styles.half}>
            <TextButton
              title={confirmLabel}
              outlined
              wide
              destructive
              onPress={() => {
                onClose();
                onConfirm();
              }}
            />
          </View>
        </View>
      }
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Sheet>
  );
}

/** "Save to my meals": the name, filled in from the meal's foods (MVP default, D-26). */
export function SaveMealSheet({
  initialName,
  onSave,
  onClose,
}: {
  initialName: string;
  onSave(name: string): void;
  onClose(): void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  return (
    <Sheet
      header={<SheetHeading icon={Bookmark} title="Save to my meals" />}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title="Save"
            filled
            disabled={trimmed === ''}
            onPress={() => {
              onClose();
              onSave(trimmed);
            }}
          />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        maxLength={SAVED_MEAL_NAME_MAX}
        autoCapitalize="sentences"
        error={trimmed === '' ? 'Enter a name.' : null}
      />
    </Sheet>
  );
}

/** "BREAKFAST", the longest meal, in the pills' condensed capitals: 4.29 em, measured from the font. */
const LONGEST_SLOT_EM = 4.29;

/**
 * "Already in this meal" (D-34): a food added again to the meal being built. "Add to existing" puts
 * the amounts together; "Keep separate" adds it as its own item, as closing the sheet does. When the
 * amounts together would pass the most one food can have, only "Keep separate" is offered.
 */
export function DuplicateFoodSheet({
  message,
  canAdd,
  onAdd,
  onKeep,
}: {
  message: string;
  /** Whether at least one food can take the amount added. */
  canAdd: boolean;
  onAdd(): void;
  onKeep(): void;
}) {
  const styles = useStyles();
  return (
    <Sheet
      title="Already in this meal"
      onClose={onKeep}
      actions={
        <>
          {canAdd ? <TextButton title="Add to existing" filled onPress={onAdd} /> : null}
          <TextButton title="Keep separate" wide={canAdd} filled={!canAdd} onPress={onKeep} />
        </>
      }
    >
      <Text style={styles.body}>{message}</Text>
    </Sheet>
  );
}

/** Picks the meal slot; the one given is preselected (Q-036), or none yet. */
export function SlotPicker({
  value,
  onChange,
  twoByTwo = false,
}: {
  value: MealType | null;
  onChange(slot: MealType): void;
  /** Always two by two, with taller blocks (re-logging a saved meal, the redesign's 3.2). */
  twoByTwo?: boolean;
}) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  const { fontScale } = useWindowDimensions();
  // The row's width, to lay the four out evenly: in one row when "BREAKFAST" fits a quarter of it
  // (with the block's padding and edge), otherwise two by two. Each line is a row of its own: a
  // wrapping row with percentage widths did not wrap on a narrow screen and ran off its side.
  const [rowWidth, setRowWidth] = useState(0);
  const oneRow = !twoByTwo && (rowWidth - 3 * 6) / 4 >= (15 * LONGEST_SLOT_EM + 9 * 0.5) * fontScale + 2 * 4 + 3;
  const lines = oneRow ? [MEAL_TYPE_ORDER] : [MEAL_TYPE_ORDER.slice(0, 2), MEAL_TYPE_ORDER.slice(2)];
  return (
    <View
      testID="slot-picker"
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      style={twoByTwo ? styles.slotLinesTall : styles.slotLines}
    >
      {lines.map((line, index) => (
        <View key={line.join()} testID={`slot-line-${index}`} style={twoByTwo ? styles.slotLineTall : styles.slotLine}>
          {line.map((slot) => (
            <Pressable
              key={slot}
              accessibilityRole="radio"
              accessibilityLabel={MEAL_TYPE_LABELS[slot]}
              accessibilityState={{ checked: value === slot }}
              onPress={() => onChange(slot)}
              style={({ pressed }) => [pill.choice, twoByTwo ? styles.slotTall : styles.slot, value === slot && pill.chosen, pressed && pill.pressed]}
            >
              <Text numberOfLines={1} style={[pill.choiceText, !twoByTwo && styles.slotText, value === slot && pill.chosenText]}>
                {MEAL_TYPE_LABELS[slot]}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Re-logs a saved meal to a date, in the slot it was saved from unless the user changes it. */
export function RelogSheet({
  name,
  dayLabel,
  slot,
  onLog,
  onClose,
}: {
  name: string;
  dayLabel: string;
  slot: MealType;
  onLog(slot: MealType): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const [chosen, setChosen] = useState(slot);
  return (
    <Sheet
      header={<SheetHeading icon={Plus} title={`Log ${name}`} />}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title="Log meal"
            filled
            onPress={() => {
              onClose();
              onLog(chosen);
            }}
          />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Text style={styles.body}>To {dayLabel}</Text>
      <SlotPicker value={chosen} onChange={setChosen} twoByTwo />
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  message: { fontSize: 16, lineHeight: 24, color: c.ink },
  // The redesign's 3.6: ruled rows on a raised card, each action in caramel capitals.
  menu: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  menuRow: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  menuText: { ...TYPE.link, fontSize: 16, color: c.accent },
  destructiveText: { color: c.danger },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  body: { fontSize: 16, lineHeight: 24 },
  // The meals are choice blocks of one width, the chosen one filled. In Log meal (3.5) four across, 6
  // apart, at 15 with little spacing so "BREAKFAST" fits a 390 phone; re-logging (3.2), two by two
  // and taller.
  slotLines: { gap: 6 },
  slotLine: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, paddingHorizontal: 4 },
  slotText: { fontSize: 15, letterSpacing: 0.5 },
  slotLinesTall: { gap: 8 },
  slotLineTall: { flexDirection: 'row', gap: 8 },
  slotTall: { flex: 1, minHeight: 48, paddingHorizontal: 8 },
}));
