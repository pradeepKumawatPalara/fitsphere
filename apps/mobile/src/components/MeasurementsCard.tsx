import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { StyleSheet, View } from 'react-native';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles } from '../theme';
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
// with "Edit measurements", or, with none, the weekly waist prompt and "Add measurements".
export function MeasurementsCard({ day, entry, unit, onAdd, onEdit }: Props) {
  const styles = useStyles();
  if (!entry) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Measurements</Text>
        <Text style={styles.body}>No measurements for {formatDay(day)}.</Text>
        <Text style={styles.hint}>Log your upper and lower waist once a week.</Text>
        <TextButton title="Add measurements" outlined onPress={onAdd} />
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
              <Text style={[styles.rowText, styles.value]}>{value}</Text>
            </View>
          );
        })}
      </View>
      {entry.notes ? (
        <Text accessibilityLabel={`Notes: ${entry.notes}`} style={styles.notes}>
          {entry.notes}
        </Text>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <TextButton title="Edit measurements" onPress={onEdit} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15 },
  hint: { fontSize: 13, color: c.textMuted },
  // Rows ruled like a tape reading.
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowText: { fontSize: 15 },
  value: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  notes: { color: c.textMuted },
  note: { fontSize: 13, color: c.warning },
}));
