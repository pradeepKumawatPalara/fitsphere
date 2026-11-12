import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { Clock } from 'lucide-react-native';
import { View } from 'react-native';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { daysBetween } from '../progress/calculations';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

type Props = {
  /** The selected date. */
  day: IstDay;
  /** Its measurements entry, or null when there is none. */
  entry: LocalMeasurements | null;
  /** The cm/in choice last made on this phone (MVP default, D-23). */
  unit: LengthUnit;
  /**
   * Home on today (D-85): when measurements were last logged, said in place of "No measurements for
   * <date>", and whether they are due. Absent on other dates and on Progress.
   */
  since?: MeasurementsSince | null;
  onAdd(): void;
  onEdit(): void;
};

/** When measurements were last logged, and whether they are due (D-85). */
export type MeasurementsSince = { line: string; due: boolean };

/** More than this many days since the last measurements, and they are due (D-85, the owner's words). */
export const MEASUREMENTS_DUE_AFTER_DAYS = 7;

/**
 * Home's card on today, with no measurements for today (D-85): "Last logged 14 days ago, on Thu 29
 * Oct.", due once more than 7 days have passed, or with none at all. The phone keeps 90 days (ADR-0007
 * rule 1), so with none on it the card says "No measurements logged yet." only when the account is
 * younger than that (`accountNewer`), and "None in the last 90 days." otherwise.
 */
export function measurementsSince(lastDay: IstDay | null, today: IstDay, accountNewer: boolean): MeasurementsSince {
  if (lastDay === null) return { line: accountNewer ? 'No measurements logged yet.' : 'None in the last 90 days.', due: true };
  const days = daysBetween(lastDay, today);
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return { line: `Last logged ${ago}, on ${formatDay(lastDay)}.`, due: days > MEASUREMENTS_DUE_AFTER_DAYS };
}

type LengthKey = 'upperWaistMm' | 'lowerWaistMm' | 'chestMm' | 'hipsMm' | 'armMm' | 'thighMm';

const ROWS: { key: LengthKey; label: string }[] = [
  { key: 'upperWaistMm', label: 'Upper waist' },
  { key: 'lowerWaistMm', label: 'Lower waist' },
  { key: 'chestMm', label: 'Chest' },
  { key: 'hipsMm', label: 'Hips' },
  { key: 'armMm', label: 'Arms' },
  { key: 'thighMm', label: 'Thighs' },
];

// The measurements card (REQ-HOME-008), always on Home (D-24). It shows the selected date's entry
// with "Edit measurements", or, with none, the weekly waist prompt and "Add measurements". The
// redesign's 2.3 (locked by the owner, 2026-11-03): ruled rows, the readings in condensed figures.
// On today, with `since` (D-85; canvas "2.3 Home · Measurements due", C locked): when they were last
// logged, and once due a caramel "Due" badge beside the title and "Add measurements" filled caramel.
export function MeasurementsCard({ day, entry, unit, since, onAdd, onEdit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!entry) {
    const due = since?.due ?? false;
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Measurements</Text>
          {due ? (
            <View accessible accessibilityLabel="Due" style={styles.due}>
              <Clock size={14} strokeWidth={2.5} color={colors.onPrimary} />
              <Text style={styles.dueText}>Due</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.body}>{since ? since.line : `No measurements for ${formatDay(day)}.`}</Text>
        <Text style={styles.hint}>Log your upper and lower waist once a week.</Text>
        <View style={styles.add}>
          <TextButton title="Add measurements" outlined strong={due} onPress={onAdd} />
        </View>
      </View>
    );
  }

  const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Measurements · {formatDay(day)}</Text>
      <View>
        {ROWS.map(({ key, label }) => {
          const mm = entry[key];
          if (mm === null) return null;
          const value = `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
          return (
            <View key={key} accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
              <Text style={styles.rowText}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          );
        })}
      </View>
      {entry.notes ? (
        <Text accessibilityLabel={`Notes: ${entry.notes}`} style={styles.notes}>
          {entry.notes}
        </Text>
      ) : null}
      {note ? <Text style={[styles.note, entry.syncState === 'rejected' && styles.notSaved]}>{note}</Text> : null}
      <TextButton title="Edit measurements" onPress={onEdit} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 4, backgroundColor: c.surface, gap: 8 },
  title: { ...TYPE.label, color: c.inkMuted },
  // The title, and the "Due" badge at its right (D-85): caramel, 24 tall, a clock and the word.
  titleRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  due: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 4, backgroundColor: c.primary },
  dueText: { ...TYPE.link, fontSize: 14, lineHeight: 16, letterSpacing: 1.5, color: c.onPrimary },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { ...TYPE.small, color: c.inkMuted },
  add: { marginTop: 4 },
  // Rows ruled like a tape reading.
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowText: { fontSize: 15, color: c.inkMuted },
  value: TYPE.dayNumber,
  notes: { color: c.inkMuted },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
}));
