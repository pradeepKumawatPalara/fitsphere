import type { IstDay, LengthUnit } from '@fitsphere/shared';
import { Button, StyleSheet, View } from 'react-native';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { Text } from '../components/ui';
import type { LocalMeasurements } from '../local/store';
import { useTheme } from '../theme';
import { Card } from './Card';
import { PROGRESS_TEXTS } from './texts';

type Props = {
  /** The phone's entries, newest first. */
  measurements: readonly LocalMeasurements[];
  unit: LengthUnit;
  onAdd(): void;
  onEdit(day: IstDay): void;
};

// Progress › Measurements (REQ-PRG-006): each entry as Home's measurements card, with "Edit
// measurements"; with none, "Add first" and the weekly waist recommendation.
export function MeasurementsSection({ measurements, unit, onAdd, onEdit }: Props) {
  const { colors } = useTheme();
  if (measurements.length === 0) {
    return (
      <Card title="Measurements">
        <Text style={{ color: colors.text }}>{PROGRESS_TEXTS.noMeasurements}</Text>
        <Text style={{ color: colors.textMuted }}>{PROGRESS_TEXTS.measurementsHint}</Text>
        <Button title="Add first" onPress={onAdd} />
      </Card>
    );
  }
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        Measurements
      </Text>
      <Button title="Add measurements" onPress={onAdd} />
      {measurements.map((entry) => (
        <MeasurementsCard key={entry.day} day={entry.day} entry={entry} unit={unit} onAdd={onAdd} onEdit={() => onEdit(entry.day)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '600' },
});
