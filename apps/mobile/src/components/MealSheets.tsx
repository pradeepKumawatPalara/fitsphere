import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { Bookmark, Check, Cookie, Moon, Plus, Sun, Sunrise, Trash, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../meals';
import { themedStyles, useTheme } from '../theme';
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
  centred = false,
}: {
  title: string;
  /** `destructive`: deletes or removes something, so it shows in the "over" red. */
  actions: { label: string; onPress(): void; destructive?: boolean }[];
  onClose(): void;
  /** Shown above the actions, e.g. a field an action uses. */
  children?: ReactNode;
  /** Each action a button of its own, its label centred (D-64: a food in Log meal's review). */
  centred?: boolean;
}) {
  const styles = useStyles();
  // The actions are a menu: full-width rows in a panel, ruled between them; or, centred, a button each.
  return (
    <Sheet title={title} onClose={onClose} actions={<TextButton title="Cancel" wide onPress={onClose} />}>
      {children}
      {actions.length > 0 ? (
        <View style={centred ? styles.buttons : styles.menu}>
          {actions.map((action, index) => (
            <Pressable
              // Labels may repeat (two saved meals with the same name), so the place keys it.
              key={`${index} ${action.label}`}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [centred ? styles.button : styles.menuRow, !centred && index > 0 && styles.ruled, pressed && styles.pressed]}
            >
              <Text style={[centred ? styles.buttonText : styles.menuText, action.destructive && styles.destructiveText]}>{action.label}</Text>
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

/** Each meal's icon on its tile in Log meal (D-58). */
const MEAL_ICONS: Record<MealType, LucideIcon> = { breakfast: Sunrise, lunch: Sun, snack: Cookie, dinner: Moon };

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
  const { colors } = useTheme();
  if (!twoByTwo) {
    // Log meal (D-58): the four always in one row, each a tile with its icon, the chosen one filled in
    // caramel with a tick. A name too long for its quarter, with large text, shrinks to fit.
    return (
      <View testID="slot-picker" style={styles.slotLines}>
        <View testID="slot-line-0" style={styles.slotLine}>
          {MEAL_TYPE_ORDER.map((slot) => {
            const chosen = value === slot;
            const Icon = MEAL_ICONS[slot];
            return (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                accessibilityLabel={MEAL_TYPE_LABELS[slot]}
                accessibilityState={{ checked: chosen }}
                onPress={() => onChange(slot)}
                style={({ pressed }) => [styles.mealTile, chosen && styles.mealTileChosen, pressed && pill.pressed]}
              >
                <Icon size={22} strokeWidth={2} color={chosen ? colors.onPrimary : colors.accent} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.mealTileText, chosen && styles.mealTileTextChosen]}>
                  {MEAL_TYPE_LABELS[slot]}
                </Text>
                {chosen ? (
                  <View style={styles.tick}>
                    <Check size={11} strokeWidth={3.5} color={colors.primary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <View testID="slot-picker" style={styles.slotLinesTall}>
      {[MEAL_TYPE_ORDER.slice(0, 2), MEAL_TYPE_ORDER.slice(2)].map((line, index) => (
        <View key={line.join()} testID={`slot-line-${index}`} style={styles.slotLineTall}>
          {line.map((slot) => (
            <Pressable
              key={slot}
              accessibilityRole="radio"
              accessibilityLabel={MEAL_TYPE_LABELS[slot]}
              accessibilityState={{ checked: value === slot }}
              onPress={() => onChange(slot)}
              style={({ pressed }) => [pill.choice, styles.slotTall, value === slot && pill.chosen, pressed && pill.pressed]}
            >
              <Text numberOfLines={1} style={[pill.choiceText, value === slot && pill.chosenText]}>
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
  // D-64: a button each, raised and outlined, the label centred.
  buttons: { gap: 10 },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  buttonText: { ...TYPE.buttonSecondary, color: c.ink, textAlign: 'center' },
  destructiveText: { color: c.danger },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  body: { fontSize: 16, lineHeight: 24 },
  // The meals in Log meal (D-58): four tiles of one width in one row, 6 apart, each with its icon over
  // its name; the chosen one filled in caramel, a tick in its corner. Re-logging (3.2): choice
  // blocks, two by two and taller.
  slotLines: { gap: 6 },
  slotLine: { flexDirection: 'row', gap: 6 },
  mealTile: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  mealTileChosen: { borderColor: c.primary, backgroundColor: c.primary },
  mealTileText: { ...TYPE.buttonSecondary, fontSize: 14, lineHeight: 16, letterSpacing: 0.3, color: c.ink },
  mealTileTextChosen: { color: c.onPrimary },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.onPrimary,
  },
  slotLinesTall: { gap: 8 },
  slotLineTall: { flexDirection: 'row', gap: 8 },
  slotTall: { flex: 1, minHeight: 48, paddingHorizontal: 8 },
}));
