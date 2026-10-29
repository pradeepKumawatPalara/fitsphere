import {
  MEAL_DELETE,
  MEAL_SET,
  MEASUREMENTS_SET,
  SAVED_MEAL_DELETE,
  SAVED_MEAL_SET,
  SLEEP_SET,
  STEPS_SET,
  TARGET_SET,
  WEIGH_IN_SET,
  type ChangeErrorCode,
  type MealType,
  type TargetKind,
} from '@fitsphere/shared';
import { Button, StyleSheet, Text, View } from 'react-native';
import { DAY_VALUES } from '../dayValues';
import { formatDay } from '../format';
import type { OutboxEntry } from '../local/store';
import { describeItems, MEAL_TYPE_LABELS } from '../meals';
import { TARGETS } from '../targets';

// A rejected change stays visible until the user fixes or discards it (ADR-0007 rule 2, D-14).
// Text from the error model: "This weight wasn't saved: <reason>. Edit or discard it.", with its
// own subject for steps, sleep, measurements and targets (MVP default, D-23).
const REASONS: Record<ChangeErrorCode, string> = {
  DAY_IN_FUTURE: 'the date is in the future',
  VALIDATION_FAILED: 'the value is not valid',
  ROLE_NOT_ENABLED: 'your account cannot log this',
  NOT_ALLOWED: 'you cannot change it',
  UNKNOWN_CHANGE_TYPE: 'this version of the app is out of date',
};

/** What a rejected change was for, and how its text starts. */
export function describeRejected(entry: OutboxEntry): { what: string; notSaved: string } {
  const data = entry.data as Record<string, unknown>;
  const day = typeof data.day === 'string' ? formatDay(data.day) : '';
  switch (entry.type) {
    case WEIGH_IN_SET:
      return { what: `${day} · ${DAY_VALUES.weighIn.format(Number(data.weightGrams))}`, notSaved: DAY_VALUES.weighIn.notSaved };
    case STEPS_SET:
      return { what: `${day} · ${DAY_VALUES.steps.format(Number(data.steps))}`, notSaved: DAY_VALUES.steps.notSaved };
    case SLEEP_SET:
      return { what: `${day} · ${DAY_VALUES.sleep.format(Number(data.sleepMinutes))}`, notSaved: DAY_VALUES.sleep.notSaved };
    case MEASUREMENTS_SET:
      return { what: `${day} · measurements`, notSaved: "These measurements weren't saved" };
    case MEAL_SET:
      return {
        what: `${day} · ${MEAL_TYPE_LABELS[data.mealType as MealType] ?? 'Meal'} · ${describeItems((data.items as { name: string }[]) ?? [])}`,
        notSaved: "This meal wasn't saved",
      };
    case MEAL_DELETE:
      return { what: 'A meal', notSaved: "This meal wasn't deleted" };
    case SAVED_MEAL_SET:
      return { what: `Saved meal · ${String(data.name)}`, notSaved: "This saved meal wasn't saved" };
    case SAVED_MEAL_DELETE:
      return { what: 'A saved meal', notSaved: "This saved meal wasn't deleted" };
    case TARGET_SET: {
      const target = TARGETS[data.kind as TargetKind];
      return {
        what: target ? `${target.label} · ${target.format(Number(data.value))}` : 'A target',
        notSaved: "This target wasn't saved",
      };
    }
    default:
      return { what: 'An entry', notSaved: "This entry wasn't saved" };
  }
}

export function rejectedText(notSaved: string, code: string | null): string {
  const reason = REASONS[code as ChangeErrorCode] ?? REASONS.VALIDATION_FAILED;
  return `${notSaved}: ${reason}. Edit or discard it.`;
}

type Props = {
  entries: OutboxEntry[];
  onEdit(entry: OutboxEntry): void;
  onDiscard(changeId: string): void;
};

export function RejectedChanges({ entries, onEdit, onDiscard }: Props) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const { what, notSaved } = describeRejected(entry);
        return (
          <View key={entry.changeId} accessibilityRole="alert" style={styles.item}>
            <Text style={styles.what}>{what}</Text>
            <Text>{rejectedText(notSaved, entry.errorCode)}</Text>
            <View style={styles.actions}>
              {/* A deletion has nothing to edit: discarding it keeps the server's copy. */}
              {entry.type === MEAL_DELETE || entry.type === SAVED_MEAL_DELETE ? null : (
                <Button title="Edit" onPress={() => onEdit(entry)} />
              )}
              <Button title="Discard" onPress={() => onDiscard(entry.changeId)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { padding: 12, gap: 6, borderRadius: 8, borderWidth: 1, borderColor: '#b00020' },
  what: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
});
