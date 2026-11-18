import { fromMillimetres, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { ChevronRight, History } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateChoices, RangeStatusView } from '../components/DateChoices';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { Text, TextButton } from '../components/ui';
import { choiceRange, LAST_90_DAYS, shownRange, type DateChoice } from '../dateRange';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Card } from './Card';
import { useMeasurementsRange } from './measurementsRange';
import { PROGRESS_TEXTS } from './texts';

type Props = {
  /** The phone's entries of the last 90 days, newest first. */
  measurements: readonly LocalMeasurements[];
  unit: LengthUnit;
  today: IstDay;
  /** Changes when the list must be read again: the measurements sheet closed. */
  refresh: unknown;
  onAdd(): void;
  onEdit(day: IstDay): void;
};

/** "1 measurement" or "N measurements". */
function measurementCount(count: number): string {
  return count === 1 ? '1 measurement' : `${count} measurements`;
}

// Progress › Measurements (REQ-PRG-006): the latest entry of the last 90 days as Home's measurements
// card, with "Edit measurements"; "Show all measurements (N)" unfolds the last 90 days' entries, the
// latest too, as a table of the two waists, each row opening that date's entry to edit (the owner,
// 2026-11-16: "(2)" showed one row, the older one alone). Unfolded, a row of choices picks other
// dates (D-114, the owner's B): Pick dates (From and To), Last 90 days, then each year back to 2000;
// a count line names the dates, and days older than the phone's 90 load online. With none in the last
// 90 days, "Add first", the weekly waist recommendation and "Older measurements".
export function MeasurementsSection({ measurements, unit, today, refresh, onAdd, onEdit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Folded at first, so the screen stays short.
  const [showAll, setShowAll] = useState(false);
  const [choice, setChoice] = useState<DateChoice>(LAST_90_DAYS);
  const range = choiceRange(choice, today);
  const chosen = useMeasurementsRange(showAll ? range : null, today, refresh);
  const shown = shownRange(choice, today);
  const listed = range ? chosen.entries : measurements;
  const status = range ? chosen.status : 'ready';
  const span = `${formatDay(shown.from, today)} – ${formatDay(shown.to, today)}`;
  const length = (mm: number) => `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
  const latest = measurements[0];

  function fold() {
    setShowAll(false);
    setChoice(LAST_90_DAYS);
  }

  const list = showAll ? (
    <>
      <DateChoices today={today} choice={choice} onChoose={setChoice} online={PROGRESS_TEXTS.measurementsOnline} />
      {status !== 'ready' ? (
        <RangeStatusView status={status} texts={MEASUREMENTS_STATUS} onRetry={chosen.retry} />
      ) : listed.length === 0 ? (
        <Text style={styles.none}>{PROGRESS_TEXTS.noMeasurementsFrom(formatDay(shown.from, today), formatDay(shown.to, today))}</Text>
      ) : (
        <>
          <Text style={styles.count}>{`${measurementCount(listed.length)} · ${span}`}</Text>
          <View style={styles.table}>
            <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={styles.day} />
              <Text style={[styles.value, styles.columnHeading]}>Upper waist</Text>
              <Text style={[styles.value, styles.columnHeading]}>Lower waist</Text>
              <View style={styles.chevron} />
            </View>
            {listed.map((entry) => {
              const upper = length(entry.upperWaistMm);
              const lower = length(entry.lowerWaistMm);
              const day = formatDay(entry.day, today);
              const note = entry.syncState === 'pending' ? 'Waiting to sync' : entry.syncState === 'rejected' ? 'Not saved' : null;
              return (
                <Pressable
                  key={entry.day}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit measurements, ${day}: Upper waist ${upper}, Lower waist ${lower}`}
                  onPress={() => onEdit(entry.day)}
                  style={({ pressed }) => [styles.row, styles.ruled, pressed && styles.pressed]}
                >
                  <View style={styles.day}>
                    <Text style={styles.body}>{day}</Text>
                    {note ? <Text style={[styles.note, entry.syncState === 'rejected' && styles.danger]}>{note}</Text> : null}
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
        </>
      )}
      <TextButton title="Show fewer" onPress={fold} />
    </>
  ) : latest ? (
    <TextButton title={`Show all measurements (${measurements.length})`} onPress={() => setShowAll(true)} />
  ) : null;

  if (!latest) {
    return (
      <View style={styles.section}>
        <Card title="Measurements">
          <View style={styles.emptyText}>
            <Text style={styles.body}>{PROGRESS_TEXTS.noMeasurements}</Text>
            <Text style={styles.small}>{PROGRESS_TEXTS.measurementsHint}</Text>
          </View>
          <TextButton title="Add first" outlined onPress={onAdd} />
          {showAll ? null : <TextButton title="Older measurements" icon={History} onPress={() => setShowAll(true)} />}
        </Card>
        {list}
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <View testID="measurements-heading-row" style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          Measurements
        </Text>
      </View>
      <MeasurementsCard showDate day={latest.day} entry={latest} unit={unit} onAdd={onAdd} onEdit={() => onEdit(latest.day)} />
      {list}
    </View>
  );
}

/** What the list says while older measurements are read, or why they could not be (D-114). */
const MEASUREMENTS_STATUS = {
  loading: PROGRESS_TEXTS.measurementsLoading,
  offline: PROGRESS_TEXTS.measurementsOffline,
  failed: PROGRESS_TEXTS.measurementsFailed,
};

// The redesign's 5.1 (locked by the owner, 2026-11-03): the section's heading in condensed capitals;
// entries ruled on a raised card, the waists in condensed figures, each row opening with a chevron; a
// waiting entry's note muted, one not saved in red. D-114 (B): the choices as the app's choice blocks
// in one row that scrolls sideways, edge to edge; the count line muted under them.
const useStyles = themedStyles((c) => ({
  section: { gap: 12 },
  // Wraps rather than pushing the button past the screen's edge.
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  heading: { ...TYPE.metric, lineHeight: 24, color: c.ink },
  emptyText: { gap: 2 },
  body: { fontSize: 15, lineHeight: 22, color: c.ink },
  small: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  count: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  none: { padding: 16, borderRadius: 4, backgroundColor: c.surfaceSunken, fontSize: 15, lineHeight: 22, color: c.inkMuted },
  table: { paddingLeft: 16, paddingRight: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  day: { flex: 1, gap: 2 },
  value: { width: 84, textAlign: 'right' },
  columnHeading: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  length: { ...TYPE.label, fontSize: 17, lineHeight: 20, letterSpacing: 0, textTransform: 'none', fontVariant: ['tabular-nums'], color: c.ink },
  note: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1, color: c.inkMuted },
  danger: { color: c.danger },
  chevron: { width: 20, alignItems: 'center' },
}));
