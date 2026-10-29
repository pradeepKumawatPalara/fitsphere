import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { Button, StyleSheet, Text, View } from 'react-native';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';

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
  if (!entry) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Measurements</Text>
        <Text>No measurements for {formatDay(day)}.</Text>
        <Text style={styles.hint}>Log your upper and lower waist once a week.</Text>
        <Button title="Add measurements" onPress={onAdd} />
      </View>
    );
  }

  const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Measurements · {formatDay(day)}</Text>
      {ROWS.map(({ key, label }) => {
        const mm = entry[key];
        if (mm === null) return null;
        const value = `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
        return (
          <View key={key} accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
            <Text>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        );
      })}
      {entry.notes ? <Text accessibilityLabel={`Notes: ${entry.notes}`}>{entry.notes}</Text> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Button title="Edit measurements" onPress={onEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 8 },
  title: { color: '#555' },
  hint: { color: '#555' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontWeight: '600' },
  note: { color: '#8a5a00' },
});
