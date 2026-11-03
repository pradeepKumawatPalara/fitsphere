import {
  MEAL_DELETE,
  MEAL_SET,
  MEASUREMENTS_SET,
  SAVED_MEAL_DELETE,
  SAVED_MEAL_SET,
  SETTING_SET,
  SLEEP_SET,
  STEPS_SET,
  TARGET_SET,
  WEIGH_IN_SET,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type BodyWeightUnit,
  type ChangeErrorCode,
  type MealType,
  type SettingName,
  type TargetKind,
} from '@fitsphere/shared';
import { View } from 'react-native';
import { dayValues } from '../dayValues';
import { formatDay } from '../format';
import type { OutboxEntry } from '../local/store';
import { describeItems, MEAL_TYPE_LABELS } from '../meals';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { targetTexts } from '../targets';
import { themedStyles } from '../theme';
import { Text, TextButton } from './ui';

// A rejected change stays visible until the user fixes or discards it (ADR-0007 rule 2, D-14).
// Text from the error model: "This weight wasn't saved: <reason>. Edit or discard it.", with its
// own subject for steps, sleep, measurements and targets (MVP default, D-23), workouts (D-29) and
// settings (D-31).
const REASONS: Record<ChangeErrorCode, string> = {
  DAY_IN_FUTURE: 'the date is in the future',
  VALIDATION_FAILED: 'the value is not valid',
  ROLE_NOT_ENABLED: 'your account cannot log this',
  NOT_ALLOWED: 'you cannot change it',
  UNKNOWN_CHANGE_TYPE: 'this version of the app is out of date',
};

/** The setting names as Settings lists them. */
const SETTING_LABELS: Record<SettingName, string> = {
  theme: 'Appearance',
  body_weight_unit: 'Body weight unit',
  lifting_weight_unit: 'Lifting weight unit',
};

/** What a rejected change was for, and how its text starts; weights in the body-weight unit. */
export function describeRejected(entry: OutboxEntry, bodyWeightUnit: BodyWeightUnit): { what: string; notSaved: string } {
  const data = entry.data as Record<string, unknown>;
  const day = typeof data.day === 'string' ? formatDay(data.day) : '';
  const values = dayValues(bodyWeightUnit);
  switch (entry.type) {
    case WEIGH_IN_SET:
      return { what: `${day} · ${values.weighIn.format(Number(data.weightGrams))}`, notSaved: values.weighIn.notSaved };
    case STEPS_SET:
      return { what: `${day} · ${values.steps.format(Number(data.steps))}`, notSaved: values.steps.notSaved };
    case SLEEP_SET:
      return { what: `${day} · ${values.sleep.format(Number(data.sleepMinutes))}`, notSaved: values.sleep.notSaved };
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
    // A workout and its deletion (MVP default, D-29).
    case WORKOUT_SET:
      return { what: `${day} · workout`, notSaved: "This workout wasn't saved" };
    case WORKOUT_DELETE:
      return { what: 'A deleted workout', notSaved: "This workout wasn't saved" };
    case TARGET_SET: {
      const target = targetTexts(bodyWeightUnit)[data.kind as TargetKind];
      return {
        what: target ? `${target.label} · ${target.format(Number(data.value))}` : 'A target',
        notSaved: "This target wasn't saved",
      };
    }
    case SETTING_SET:
      return { what: SETTING_LABELS[data.name as SettingName] ?? 'A setting', notSaved: "This setting wasn't saved" };
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
  /** Left out where the entry is already being edited, e.g. on its workout's screen. */
  onEdit?: (entry: OutboxEntry) => void;
  onDiscard(changeId: string): void;
};

export function RejectedChanges({ entries, onEdit, onDiscard }: Props) {
  const styles = useStyles();
  const bodyWeightUnit = useBodyWeightUnit();
  if (entries.length === 0) return null;
  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const { what, notSaved } = describeRejected(entry, bodyWeightUnit);
        return (
          <View key={entry.changeId} accessibilityRole="alert" style={styles.item}>
            <Text style={styles.what}>{what}</Text>
            <Text style={styles.message}>{rejectedText(notSaved, entry.errorCode)}</Text>
            <View style={styles.actions}>
              {/* A meal's deletion has nothing to edit: discarding it keeps the server's copy. */}
              {!onEdit || entry.type === MEAL_DELETE || entry.type === SAVED_MEAL_DELETE ? null : (
                <TextButton title="Edit" onPress={() => onEdit(entry)} />
              )}
              <TextButton title="Discard" destructive onPress={() => onDiscard(entry.changeId)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  list: { gap: 8 },
  item: { padding: 14, gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: c.danger },
  what: { fontSize: 15, fontWeight: '600' },
  message: { fontSize: 15 },
  actions: { flexDirection: 'row', gap: 24 },
}));
