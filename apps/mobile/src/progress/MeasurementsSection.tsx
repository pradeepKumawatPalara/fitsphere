import Ionicons from '@expo/vector-icons/Ionicons';
import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
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

// Progress › Measurements (REQ-PRG-006): the latest entry as Home's measurements card, with "Edit
// measurements"; the older ones folded under "Show all measurements (N)", as a table of the two
// waists, each row opening that date's entry to edit. With none, "Add first" and the weekly waist
// recommendation.
export function MeasurementsSection({ measurements, unit, onAdd, onEdit }: Props) {
  const { colors } = useTheme();
  // Folded at first, so the screen stays short.
  const [showAll, setShowAll] = useState(false);
  const [latest, ...older] = measurements;
  if (!latest) {
    return (
      <Card title="Measurements">
        <Text style={[styles.body, { color: colors.text }]}>{PROGRESS_TEXTS.noMeasurements}</Text>
        <Text style={[styles.small, { color: colors.textMuted }]}>{PROGRESS_TEXTS.measurementsHint}</Text>
        <TextButton title="Add first" outlined onPress={onAdd} />
      </Card>
    );
  }
  const length = (mm: number) => `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        Measurements
      </Text>
      <TextButton title="Add measurements" outlined onPress={onAdd} />
      <MeasurementsCard day={latest.day} entry={latest} unit={unit} onAdd={onAdd} onEdit={() => onEdit(latest.day)} />
      {older.length > 0 && showAll ? (
        <View style={[styles.table, { backgroundColor: colors.surface }]}>
          <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.day} />
            <Text style={[styles.value, styles.small, { color: colors.textMuted }]}>Upper waist</Text>
            <Text style={[styles.value, styles.small, { color: colors.textMuted }]}>Lower waist</Text>
            <View style={styles.chevron} />
          </View>
          {older.map((entry) => {
            const upper = length(entry.upperWaistMm);
            const lower = length(entry.lowerWaistMm);
            const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
            return (
              <Pressable
                key={entry.day}
                accessibilityRole="button"
                accessibilityLabel={`Edit measurements, ${formatDay(entry.day)}: Upper waist ${upper}, Lower waist ${lower}`}
                onPress={() => onEdit(entry.day)}
                style={({ pressed }) => [styles.row, styles.ruled, { borderTopColor: colors.border }, pressed && styles.pressed]}
              >
                <View style={styles.day}>
                  <Text style={[styles.body, { color: colors.text }]}>{formatDay(entry.day)}</Text>
                  {note ? <Text style={[styles.small, { color: colors.warning }]}>{note}</Text> : null}
                </View>
                <Text style={[styles.value, styles.body, styles.digits, { color: colors.text }]}>{upper}</Text>
                <Text style={[styles.value, styles.body, styles.digits, { color: colors.text }]}>{lower}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {older.length > 0 ? (
        <TextButton
          title={showAll ? 'Show fewer' : `Show all measurements (${measurements.length})`}
          onPress={() => setShowAll((shown) => !shown)}
        />
      ) : null}
    </View>
  );
}

// The table as Home's ruled rows: 48 tall, the waists in fixed-width digits, right-aligned.
const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  table: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
  day: { flex: 1 },
  value: { width: 84, textAlign: 'right' },
  digits: { fontVariant: ['tabular-nums'] },
  chevron: { width: 16 },
});
