import { EARLIEST_DAY, fromMillimetres, syncWindowStart, type IstDay, type LengthUnit } from '@fitsphere/shared';
import { Calendar, ChevronRight, History, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { CalendarSheet } from '../components/CalendarSheet';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { Banner, Text, TextButton, useChoiceStyles } from '../components/ui';
import { formatDay } from '../format';
import type { LocalMeasurements } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Card } from './Card';
import { MeasurementDatesSheet } from './MeasurementDatesSheet';
import { rangeYears, useMeasurementsRange, yearRange, type DayRange } from './measurementsRange';
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

/** The dates the list shows (D-114): the last 90 days, a year, or dates picked. */
type Choice = { kind: 'last90' } | { kind: 'year'; year: number } | { kind: 'picked'; range: DayRange };

/** The dates sheet, or the calendar for one of its ends. */
type DatesStep = { step: 'dates'; range: DayRange } | { step: 'calendar'; end: 'from' | 'to'; range: DayRange };

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
  const pill = useChoiceStyles();
  // Folded at first, so the screen stays short.
  const [showAll, setShowAll] = useState(false);
  const [choice, setChoice] = useState<Choice>({ kind: 'last90' });
  const [dates, setDates] = useState<DatesStep | null>(null);
  const range: DayRange | null = choice.kind === 'year' ? yearRange(choice.year, today) : choice.kind === 'picked' ? choice.range : null;
  const chosen = useMeasurementsRange(showAll ? range : null, today, refresh);
  const shown = range ?? { from: syncWindowStart(today), to: today };
  const listed = range ? chosen.entries : measurements;
  const status = range ? chosen.status : 'ready';
  const span = `${formatDay(shown.from, today)} – ${formatDay(shown.to, today)}`;
  const length = (mm: number) => `${fromMillimetres(mm, unit).toFixed(1)} ${unit}`;
  const latest = measurements[0];

  function fold() {
    setShowAll(false);
    setChoice({ kind: 'last90' });
  }

  // The calendar calls onSelect, then onClose: each builds on the step it finds, so the close after a
  // pick keeps the day picked.
  function pickEnd(day: IstDay) {
    setDates((current) => {
      if (current?.step !== 'calendar') return current;
      const { end, range: picked } = current;
      // From after To, or To before From, moves the other end with it.
      const next = end === 'from' ? { from: day, to: day > picked.to ? day : picked.to } : { from: day < picked.from ? day : picked.from, to: day };
      return { step: 'dates', range: next };
    });
  }

  function closeCalendar() {
    setDates((current) => (current?.step === 'calendar' ? { step: 'dates', range: current.range } : current));
  }

  const choices: { key: string; label: string; selected: boolean; icon?: typeof Calendar; onPress(): void }[] = [
    { key: 'picked', label: 'Pick dates', icon: Calendar, selected: choice.kind === 'picked', onPress: () => setDates({ step: 'dates', range: shown }) },
    { key: 'last90', label: 'Last 90 days', selected: choice.kind === 'last90', onPress: () => setChoice({ kind: 'last90' }) },
    ...rangeYears(today).map((year) => ({
      key: String(year),
      label: String(year),
      selected: choice.kind === 'year' && choice.year === year,
      onPress: () => setChoice({ kind: 'year', year }),
    })),
  ];

  const list = showAll ? (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Dates"
        style={styles.choicesScroll}
        contentContainerStyle={styles.choices}
      >
        {choices.map(({ key, label, selected, icon: Icon, onPress }) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            onPress={onPress}
            style={({ pressed }) => [pill.choice, styles.choice, selected && pill.chosen, pressed && pill.pressed]}
          >
            {Icon ? <Icon size={16} strokeWidth={2.25} color={selected ? colors.onPrimary : colors.accent} /> : null}
            <Text style={[pill.choiceText, styles.choiceText, selected && pill.chosenText]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>{PROGRESS_TEXTS.measurementsLoading}</Text>
        </View>
      ) : status === 'offline' || status === 'failed' ? (
        <View style={styles.problem}>
          <Banner
            tone="error"
            text={status === 'offline' ? PROGRESS_TEXTS.measurementsOffline : PROGRESS_TEXTS.measurementsFailed}
            {...(status === 'offline' ? { icon: WifiOff } : {})}
          />
          <TextButton title="Try again" onPress={chosen.retry} />
        </View>
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

  const sheets =
    dates?.step === 'dates' ? (
      <MeasurementDatesSheet
        from={dates.range.from}
        to={dates.range.to}
        today={today}
        onChange={(end) => setDates({ step: 'calendar', end, range: dates.range })}
        onShow={() => {
          setChoice({ kind: 'picked', range: dates.range });
          setDates(null);
        }}
        onClose={() => setDates(null)}
      />
    ) : dates?.step === 'calendar' ? (
      <CalendarSheet
        title={dates.end === 'from' ? 'From' : 'To'}
        today={today}
        firstDay={EARLIEST_DAY}
        selected={dates.range[dates.end]}
        onSelect={pickEnd}
        onClose={closeCalendar}
      />
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
        {sheets}
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
      {sheets}
    </View>
  );
}

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
  choicesScroll: { marginHorizontal: -16, flexGrow: 0 },
  choices: { gap: 8, paddingHorizontal: 16 },
  choice: { flexDirection: 'row', gap: 6 },
  choiceText: { fontSize: 15 },
  count: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 4, backgroundColor: c.surfaceSunken },
  loadingText: { fontSize: 14, color: c.inkMuted },
  problem: { gap: 4, alignItems: 'flex-start' },
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
