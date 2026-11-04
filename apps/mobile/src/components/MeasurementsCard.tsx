import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { View } from 'react-native';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

type Props = {
  /** The selected date. */
  day: IstDay;
  /** Its measurements entry, or null when there is none. */
  entry: LocalMeasurements | null;
  /** The cm/in choice last made on this phone (MVP default, D-23). */
  unit: LengthUnit;
  onAdd(): void;
  onEdit(): void;
};

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
export function MeasurementsCard({ day, entry, unit, onAdd, onEdit }: Props) {
  const styles = useStyles();
  if (!entry) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Measurements</Text>
        <Text style={styles.body}>No measurements for {formatDay(day)}.</Text>
        <Text style={styles.hint}>Log your upper and lower waist once a week.</Text>
        <View style={styles.add}>
          <TextButton title="Add measurements" outlined onPress={onAdd} />
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
