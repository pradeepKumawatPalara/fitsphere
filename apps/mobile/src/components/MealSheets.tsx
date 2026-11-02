import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../meals';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useChoiceStyles, useFieldInputStyle } from './ui';

// Bottom sheets for the meal menus (REQ-NUT-004, REQ-SAVED-001): a list of actions, a
// confirmation, a name, and re-logging a saved meal.

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

/** Asks before something that cannot be undone, such as deleting a meal (MVP default, D-26). */
export function ConfirmSheet({
  title,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
}) {
  const styles = useStyles();
  // As every confirmation: the way out on the left, the action in red on the right, the same size.
  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextButton title="Cancel" outlined wide onPress={onClose} />
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
    />
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
  const fieldInput = useFieldInputStyle();
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  return (
    <Sheet
      title="Save to my meals"
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
      <TextInput
        accessibilityLabel="Name"
        value={name}
        onChangeText={setName}
        maxLength={SAVED_MEAL_NAME_MAX}
        style={fieldInput}
      />
    </Sheet>
  );
}

/** "Breakfast", the longest meal, is about 4.5 em wide at the pills' 15. */
const LONGEST_SLOT_EM = 4.5;

/** Picks the meal slot; the one given is preselected (Q-036), or none yet. */
export function SlotPicker({ value, onChange }: { value: MealType | null; onChange(slot: MealType): void }) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  const { fontScale } = useWindowDimensions();
  // The row's width, to lay the four out evenly: in one row when "Breakfast" fits a quarter of it
  // (with the pill's padding and edge), otherwise two by two.
  const [rowWidth, setRowWidth] = useState(0);
  const oneRow = (rowWidth - 3 * 8) / 4 >= 15 * LONGEST_SLOT_EM * fontScale + 2 * 8 + 3;
  return (
    <View onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)} style={[styles.slots, !oneRow && styles.slotsGrid]}>
      {MEAL_TYPE_ORDER.map((slot) => (
        <Pressable
          key={slot}
          accessibilityRole="radio"
          accessibilityLabel={MEAL_TYPE_LABELS[slot]}
          accessibilityState={{ checked: value === slot }}
          onPress={() => onChange(slot)}
          style={({ pressed }) => [pill.choice, oneRow ? styles.slotInRow : styles.slotInGrid, value === slot && pill.chosen, pressed && pill.pressed]}
        >
          <Text numberOfLines={1} style={[pill.choiceText, value === slot && pill.chosenText]}>
            {MEAL_TYPE_LABELS[slot]}
          </Text>
        </Pressable>
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
      title={`Log ${name}`}
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
      <SlotPicker value={chosen} onChange={setChosen} />
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  menu: { borderRadius: 12, backgroundColor: c.surface },
  menuRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  menuText: { fontSize: 15, fontWeight: '600', color: c.primary },
  destructiveText: { color: c.over },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  body: { fontSize: 15 },
  // The meals are choice pills of one width: the chosen one filled, as the selected day is on the
  // week strip. Two by two, each takes half the row (two of 40% fit beside each other, three don't).
  slots: { flexDirection: 'row', gap: 8 },
  slotsGrid: { flexWrap: 'wrap' },
  slotInRow: { flex: 1, paddingHorizontal: 8 },
  slotInGrid: { flexGrow: 1, flexBasis: '40%', paddingHorizontal: 8 },
}));
