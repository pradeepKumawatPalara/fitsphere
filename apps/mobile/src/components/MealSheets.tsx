import { SAVED_MEAL_NAME_MAX, type MealType } from '@fitsphere/shared';
import { Bookmark, Check, Cookie, Moon, Plus, SquarePen, Sun, Sunrise, Trash, type LucideIcon } from 'lucide-react-native';
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

/** What the name sheet says while a new saved meal has no name yet (D-69). */
export const SAVED_NAME_HINT = 'Give the meal a name, then add its foods.';

/**
 * A saved meal's name. "Save to my meals" on a logged meal: filled in from its foods (MVP default,
 * D-26), an empty name an error. A new saved meal (D-69): asked first, empty, with a hint until it is
 * given, before its foods; and changing the name of one.
 */
export function SaveMealSheet({
  initialName,
  title = 'Save to my meals',
  actionLabel = 'Save',
  emptyHint,
  onSave,
  onClose,
}: {
  initialName: string;
  title?: string;
  actionLabel?: string;
  /** Shown under an empty name in place of the error, and the tile then sits beside the title. */
  emptyHint?: string;
  onSave(name: string): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  return (
    <Sheet
      header={<SheetHeading icon={Bookmark} title={title} inline={emptyHint !== undefined} />}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title={actionLabel}
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
        placeholder={emptyHint === undefined ? undefined : 'For example, Monday breakfast'}
        error={trimmed === '' && emptyHint === undefined ? 'Enter a name.' : null}
      />
      {trimmed === '' && emptyHint !== undefined ? <Text style={styles.hint}>{emptyHint}</Text> : null}
    </Sheet>
  );
}

/**
 * "Already in my meals" (REQ-SAVED-001): the foods and amounts are a saved meal already, so no copy is
 * made; "Go to Saved" shows it.
 */
export function AlreadySavedSheet({ savedAs, intro, onGoToSaved, onClose }: { savedAs: string; intro: string; onGoToSaved(): void; onClose(): void }) {
  const styles = useStyles();
  return (
    <Sheet
      header={<SheetHeading icon={Bookmark} title="Already in my meals" inline />}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title="Go to Saved"
            filled
            onPress={() => {
              onClose();
              onGoToSaved();
            }}
          />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Text style={styles.body}>
        {intro} {savedAs}.
      </Text>
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
  logged,
}: {
  value: MealType | null;
  onChange(slot: MealType): void;
  /** Always two by two, with taller blocks (re-logging a saved meal, the redesign's 3.2). */
  twoByTwo?: boolean;
  /** Log meal (D-68): the meals that have food on the date, each with a green tick. */
  logged?: ReadonlySet<MealType>;
}) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  const { colors } = useTheme();
  if (!twoByTwo) {
    // Log meal (D-58, D-68): the four always in one row, each a tile with its icon, the chosen one
    // filled in caramel; a green tick in the corner of each meal with food. A name too long for its
    // quarter, with large text, shrinks to fit.
    return (
      <View testID="slot-picker" style={styles.slotLines}>
        <View testID="slot-line-0" style={styles.slotLine}>
          {MEAL_TYPE_ORDER.map((slot) => {
            const chosen = value === slot;
            const hasFood = logged?.has(slot) ?? false;
            const Icon = MEAL_ICONS[slot];
            return (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                accessibilityLabel={MEAL_TYPE_LABELS[slot]}
                accessibilityState={{ checked: chosen }}
                accessibilityValue={hasFood ? { text: 'has food' } : undefined}
                onPress={() => onChange(slot)}
                style={({ pressed }) => [styles.mealTile, chosen && styles.mealTileChosen, pressed && pill.pressed]}
              >
                <Icon size={22} strokeWidth={2} color={chosen ? colors.onPrimary : colors.accent} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.mealTileText, chosen && styles.mealTileTextChosen]}>
                  {MEAL_TYPE_LABELS[slot]}
                </Text>
                {hasFood ? (
                  <View testID={`has-food-${slot}`} style={styles.tick}>
                    <Check size={10} strokeWidth={4} color={colors.bg} />
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

/**
 * Logs a saved meal to a date (REQ-SAVED-001). A saved meal has no meal of its own (D-69), so the user
 * chooses one each time: "Log meal" logs it as it is; "Change amounts first" opens Log meal with its
 * foods, for this day only.
 */
export function RelogSheet({
  name,
  dayLabel,
  onLog,
  onChangeFirst,
  onClose,
}: {
  name: string;
  dayLabel: string;
  onLog(slot: MealType): void;
  /** With the meal chosen, if one is. */
  onChangeFirst(slot: MealType | null): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const [chosen, setChosen] = useState<MealType | null>(null);
  return (
    <Sheet
      header={<SheetHeading icon={Plus} title={`Log ${name}`} inline />}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title="Log meal"
            filled
            disabled={chosen === null}
            onPress={() => {
              if (chosen === null) return;
              onClose();
              onLog(chosen);
            }}
          />
          <TextButton
            title="Change amounts first"
            outlined
            wide
            icon={SquarePen}
            onPress={() => {
              onClose();
              onChangeFirst(chosen);
            }}
          />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Text style={styles.body}>To {dayLabel}</Text>
      <SlotPicker value={chosen} onChange={setChosen} twoByTwo />
      {chosen === null ? <Text style={styles.hint}>Choose the meal: Breakfast, Lunch, Snack or Dinner.</Text> : null}
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
  hint: { ...TYPE.small, color: c.inkMuted },
  // The meals in Log meal (D-58): four tiles of one width in one row, 6 apart, each with its icon over
  // its name; the chosen one filled in caramel. A meal with food has a green tick in its corner,
  // ringed in the page colour so it stands out on caramel too (D-68). Re-logging (3.2): choice
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.success,
  },
  slotLinesTall: { gap: 8 },
  slotLineTall: { flexDirection: 'row', gap: 8 },
  slotTall: { flex: 1, minHeight: 48, paddingHorizontal: 8 },
}));
