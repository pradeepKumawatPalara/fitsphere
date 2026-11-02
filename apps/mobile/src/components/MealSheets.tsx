import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { useState, type ReactNode } from 'react';
import { Button, Modal, Pressable, View } from 'react-native';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { Text, TextInput } from './ui';

// Bottom sheets for the meal menus (REQ-NUT-004, REQ-SAVED-001): a list of actions, a
// confirmation, a name, and re-logging a saved meal.

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const styles = useStyles();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

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
  return (
    <Sheet title={title} onClose={onClose}>
      {children}
      {actions.map((action) => (
        <Button
          key={action.label}
          title={action.label}
          onPress={() => {
            onClose();
            action.onPress();
          }}
        />
      ))}
      <Button title="Cancel" onPress={onClose} />
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
  const { colors } = useTheme();
  return (
    <Sheet title={title} onClose={onClose}>
      <Button
        title={confirmLabel}
        color={colors.error}
        onPress={() => {
          onClose();
          onConfirm();
        }}
      />
      <Button title="Cancel" onPress={onClose} />
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
  const styles = useStyles();
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  return (
    <Sheet title="Save to my meals" onClose={onClose}>
      <TextInput
        accessibilityLabel="Name"
        value={name}
        onChangeText={setName}
        maxLength={SAVED_MEAL_NAME_MAX}
        style={styles.input}
      />
      <Button
        title="Save"
        disabled={trimmed === ''}
        onPress={() => {
          onClose();
          onSave(trimmed);
        }}
      />
      <Button title="Cancel" onPress={onClose} />
    </Sheet>
  );
}

/** Picks the meal slot; the one given is preselected (Q-036), or none yet. */
export function SlotPicker({ value, onChange }: { value: MealType | null; onChange(slot: MealType): void }) {
  const styles = useStyles();
  return (
    <View style={styles.slots}>
      {MEAL_TYPE_ORDER.map((slot) => (
        <Pressable
          key={slot}
          accessibilityRole="radio"
          accessibilityLabel={MEAL_TYPE_LABELS[slot]}
          accessibilityState={{ checked: value === slot }}
          onPress={() => onChange(slot)}
          style={[styles.slot, value === slot && styles.slotChosen]}
        >
          <Text style={[styles.slotText, value === slot && styles.slotChosenText]}>{MEAL_TYPE_LABELS[slot]}</Text>
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
  const [chosen, setChosen] = useState(slot);
  return (
    <Sheet title={`Log ${name}`} onClose={onClose}>
      <Text>To {dayLabel}</Text>
      <SlotPicker value={chosen} onChange={setChosen} />
      <Button
        title="Log meal"
        onPress={() => {
          onClose();
          onLog(chosen);
        }}
      />
      <Button title="Cancel" onPress={onClose} />
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: c.background, padding: 24, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: c.textFaint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  // The chosen meal is a filled pill, as the selected day is on the week strip.
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: c.primary },
  slotChosen: { backgroundColor: c.primary },
  slotText: { fontSize: 15 },
  slotChosenText: { color: c.onPrimary, fontWeight: '600' },
}));
