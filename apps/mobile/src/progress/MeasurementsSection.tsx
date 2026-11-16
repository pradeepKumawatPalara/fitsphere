import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
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
// measurements"; with more than one, all of them, the latest too, folded under "Show all measurements
// (N)", as a table of the two waists, each row opening that date's entry to edit (the owner,
// 2026-11-16: "(2)" showed one row, the older one alone). With none, "Add first" and the weekly waist
// recommendation. The heading and its Add button share a row when they fit; on a narrow screen or a
// larger font the button goes under the heading, whole (the owner's OnePlus Nord CE4, 2026-11-16).
export function MeasurementsSection({ measurements, unit, onAdd, onEdit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Folded at first, so the screen stays short.
  const [showAll, setShowAll] = useState(false);
  const latest = measurements[0];
  if (!latest) {
    return (
      <Card title="Measurements">
        <View style={styles.emptyText}>
          <Text style={styles.body}>{PROGRESS_TEXTS.noMeasurements}</Text>
          <Text style={styles.small}>{PROGRESS_TEXTS.measurementsHint}</Text>
        </View>
        <TextButton title="Add first" outlined onPress={onAdd} />
      </Card>
    );
  }
  const length = (mm: number) => `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
  return (
    <View style={styles.section}>
      <View testID="measurements-heading-row" style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          Measurements
        </Text>
        <TextButton title="Add measurements" outlined icon={Plus} onPress={onAdd} />
      </View>
      <MeasurementsCard day={latest.day} entry={latest} unit={unit} onAdd={onAdd} onEdit={() => onEdit(latest.day)} />
      {measurements.length > 1 && showAll ? (
        <View style={styles.table}>
          <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.day} />
            <Text style={[styles.value, styles.columnHeading]}>Upper waist</Text>
            <Text style={[styles.value, styles.columnHeading]}>Lower waist</Text>
            <View style={styles.chevron} />
          </View>
          {measurements.map((entry) => {
            const upper = length(entry.upperWaistMm);
            const lower = length(entry.lowerWaistMm);
            const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
            return (
              <Pressable
                key={entry.day}
                accessibilityRole="button"
                accessibilityLabel={`Edit measurements, ${formatDay(entry.day)}: Upper waist ${upper}, Lower waist ${lower}`}
                onPress={() => onEdit(entry.day)}
                style={({ pressed }) => [styles.row, styles.ruled, pressed && styles.pressed]}
              >
                <View style={styles.day}>
                  <Text style={styles.body}>{formatDay(entry.day)}</Text>
                  {note ? <Text style={[styles.note, entry.syncState === 'rejected' && styles.problem]}>{note}</Text> : null}
                </View>
                <Text style={[styles.value, styles.length]}>{upper}</Text>
                <Text style={[styles.value, styles.length]}>{lower}</Text>
                <View style={styles.chevron}>
                  <ChevronRight size={18} strokeWidth={2.25} color={colors.accent} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {measurements.length > 1 ? (
        <TextButton
          title={showAll ? 'Show fewer' : `Show all measurements (${measurements.length})`}
          onPress={() => setShowAll((shown) => !shown)}
        />
      ) : null}
    </View>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the section's heading in condensed capitals
// beside its Add button; older entries ruled on a raised card, the waists in condensed figures, each
// row opening with a chevron; a waiting entry's note muted, one not saved in red.
const useStyles = themedStyles((c) => ({
  section: { gap: 12 },
  // Wraps rather than pushing the button past the screen's edge.
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  heading: { ...TYPE.metric, lineHeight: 24, color: c.ink },
  emptyText: { gap: 2 },
  body: { fontSize: 15, lineHeight: 22, color: c.ink },
  small: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  table: { paddingLeft: 16, paddingRight: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  day: { flex: 1, gap: 2 },
  value: { width: 84, textAlign: 'right' },
  columnHeading: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  length: { ...TYPE.label, fontSize: 17, lineHeight: 20, letterSpacing: 0, textTransform: 'none', fontVariant: ['tabular-nums'], color: c.ink },
  note: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1, color: c.inkMuted },
  problem: { color: c.danger },
  chevron: { width: 20, alignItems: 'center' },
}));
