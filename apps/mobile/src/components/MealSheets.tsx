import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  actions: { label: string; onPress(): void }[];
  onClose(): void;
  /** Shown above the actions, e.g. a field an action uses. */
  children?: ReactNode;
}) {
  const styles = useStyles();
  // The actions are a menu: full-width rows in a panel, ruled between them.
  return (
    <Sheet title={title} onClose={onClose} actions={<TextButton title="Cancel" onPress={onClose} />}>
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
              <Text style={styles.menuText}>{action.label}</Text>
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
  // As Delete account: the action in red, outlined, beside a way out of the same weight.
  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={
        <View style={styles.pair}>
          <TextButton
            title={confirmLabel}
            outlined
            destructive
            onPress={() => {
              onClose();
              onConfirm();
            }}
          />
          <TextButton title="Cancel" outlined onPress={onClose} />
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
          <TextButton title="Cancel" onPress={onClose} />
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

/** Picks the meal slot; the one given is preselected (Q-036), or none yet. */
export function SlotPicker({ value, onChange }: { value: MealType | null; onChange(slot: MealType): void }) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  return (
    <View style={styles.slots}>
      {MEAL_TYPE_ORDER.map((slot) => (
        <Pressable
          key={slot}
          accessibilityRole="radio"
          accessibilityLabel={MEAL_TYPE_LABELS[slot]}
          accessibilityState={{ checked: value === slot }}
          onPress={() => onChange(slot)}
          style={({ pressed }) => [pill.choice, value === slot && pill.chosen, pressed && pill.pressed]}
        >
          <Text style={[pill.choiceText, value === slot && pill.chosenText]}>{MEAL_TYPE_LABELS[slot]}</Text>
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
          <TextButton title="Cancel" onPress={onClose} />
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
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  body: { fontSize: 15 },
  // The meals are choice pills: the chosen one filled, as the selected day is on the week strip.
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
