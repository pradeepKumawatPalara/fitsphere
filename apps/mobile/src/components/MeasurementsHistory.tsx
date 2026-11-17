import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

type Props = {
  /** The phone's entries, newest first. */
  measurements: readonly LocalMeasurements[];
  unit: LengthUnit;
  onEdit(day: IstDay): void;
};

type LengthKey = 'upperWaistMm' | 'lowerWaistMm';

const FIELDS: { key: LengthKey; label: string }[] = [
  { key: 'upperWaistMm', label: 'Upper waist' },
  { key: 'lowerWaistMm', label: 'Lower waist' },
];

// "Show all measurements (N)": every entry on the phone, newest first, folded until asked for, each
// with the two waists (upper and lower) and
// opening that date's entry to edit. Shared by Progress and Home. Nothing with fewer than two entries.
export function MeasurementsHistory({ measurements, unit, onEdit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  if (measurements.length < 2) return null;
  const cellFor = (entry: LocalMeasurements, key: LengthKey) => {
    const mm = entry[key];
    return mm === null ? '–' : `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
  };
  return (
    <View style={styles.section}>
      {showAll ? (
        <View style={styles.table}>
          <View>
            <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={styles.day} />
              {FIELDS.map(({ key, label }) => (
                <Text key={key} style={[styles.value, styles.columnHeading]}>
                  {label}
                </Text>
              ))}
              <View style={styles.chevron} />
            </View>
            {measurements.map((entry) => {
              const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
              const spoken = FIELDS.flatMap(({ key, label }) => (entry[key] === null ? [] : [`${label} ${cellFor(entry, key)}`])).join(', ');
              return (
                <Pressable
                  key={entry.day}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit measurements, ${formatDay(entry.day)}: ${spoken}`}
                  onPress={() => onEdit(entry.day)}
                  style={({ pressed }) => [styles.row, styles.ruled, pressed && styles.pressed]}
                >
                  <View style={styles.day}>
                    <Text style={styles.date}>{formatDay(entry.day)}</Text>
                    {note ? <Text style={[styles.note, entry.syncState === 'rejected' && styles.problem]}>{note}</Text> : null}
                  </View>
                  {FIELDS.map(({ key }) => (
                    <Text key={key} style={[styles.value, styles.length]}>
                      {cellFor(entry, key)}
                    </Text>
                  ))}
                  <View style={styles.chevron}>
                    <ChevronRight size={18} strokeWidth={2.25} color={colors.accent} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <TextButton title={showAll ? 'Show fewer' : `Show all measurements (${measurements.length})`} onPress={() => setShowAll((shown) => !shown)} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  section: { gap: 12 },
  table: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  day: { flex: 1, gap: 2 },
  date: { fontSize: 15, lineHeight: 22, color: c.ink },
  value: { width: 84, textAlign: 'right' },
  columnHeading: {
    ...TYPE.label,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1,
    color: c.inkMuted,
  },
  length: {
    ...TYPE.label,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0,
    textTransform: 'none',
    fontVariant: ['tabular-nums'],
    color: c.ink,
  },
  note: {
    ...TYPE.label,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1,
    color: c.inkMuted,
  },
  problem: { color: c.danger },
  chevron: { width: 20, alignItems: 'center' },
}));
