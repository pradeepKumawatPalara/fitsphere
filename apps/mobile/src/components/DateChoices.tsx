import { EARLIEST_DAY, type IstDay } from '@fitsphere/shared';
import { Calendar, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { rangeYears, shownRange, type DateChoice, type DayRange, type RangeStatus } from '../dateRange';
import { themedStyles, useTheme } from '../theme';
import { CalendarSheet } from './CalendarSheet';
import { DatesSheet } from './DatesSheet';
import { PickDatesSheet } from './PickDatesSheet';
import { Banner, Text, TextButton, useChoiceStyles } from './ui';

/** The dates sheet, or the calendar for one of its ends. */
type DatesStep = { step: 'dates'; range: DayRange } | { step: 'calendar'; end: 'from' | 'to'; range: DayRange };

type Props = {
  today: IstDay;
  choice: DateChoice;
  onChoose(choice: DateChoice): void;
  /** What the dates sheet says loads online, e.g. "Workouts older than 90 days load online." */
  online: string;
  /** What the choices are for, said after each name by a screen reader when a screen has two rows ("2024, weeks"). */
  forWhat?: string;
  /** Pick dates also offers a start year and an end year (Progress's Week by week, the owner's B). */
  byYears?: boolean;
  /** A choice for each year after Last 90 days; false where Pick dates already picks years (Week by week). */
  yearChoices?: boolean;
};

// The row of date choices (D-114, the owner's B; shared by D-116's lists, the owner's A): Pick dates,
// Last 90 days, then each year back to 2000, as the app's choice blocks in one row that scrolls
// sideways, edge to edge (the screen's padding is 16). Pick dates opens From and To, each from the
// calendar; Show picks them, Cancel leaves the choice as it was.
export function DateChoices({ today, choice, onChoose, online, forWhat, byYears = false, yearChoices = true }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const [dates, setDates] = useState<DatesStep | null>(null);

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
    {
      key: 'picked',
      label: 'Pick dates',
      icon: Calendar,
      selected: choice.kind === 'picked',
      onPress: () => setDates({ step: 'dates', range: shownRange(choice, today) }),
    },
    { key: 'last90', label: 'Last 90 days', selected: choice.kind === 'last90', onPress: () => onChoose({ kind: 'last90' }) },
    ...(yearChoices
      ? rangeYears(today).map((year) => ({
          key: String(year),
          label: String(year),
          selected: choice.kind === 'year' && choice.year === year,
          onPress: () => onChoose({ kind: 'year', year }),
        }))
      : []),
  ];

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel={forWhat ? `Dates, ${forWhat}` : 'Dates'}
        style={styles.choicesScroll}
        contentContainerStyle={styles.choices}
      >
        {choices.map(({ key, label, selected, icon: Icon, onPress }) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={forWhat ? `${label}, ${forWhat}` : label}
            accessibilityState={{ checked: selected }}
            onPress={onPress}
            style={({ pressed }) => [pill.choice, styles.choice, selected && pill.chosen, pressed && pill.pressed]}
          >
            {Icon ? <Icon size={16} strokeWidth={2.25} color={selected ? colors.onPrimary : colors.accent} /> : null}
            <Text style={[pill.choiceText, styles.choiceText, selected && pill.chosenText]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {dates?.step === 'dates' && byYears ? (
        <PickDatesSheet
          from={dates.range.from}
          to={dates.range.to}
          today={today}
          online={online}
          onChange={(end) => setDates({ step: 'calendar', end, range: dates.range })}
          onShow={(years) => {
            onChoose({ kind: 'picked', range: years ?? dates.range });
            setDates(null);
          }}
          onClose={() => setDates(null)}
        />
      ) : dates?.step === 'dates' ? (
        <DatesSheet
          from={dates.range.from}
          to={dates.range.to}
          today={today}
          online={online}
          onChange={(end) => setDates({ step: 'calendar', end, range: dates.range })}
          onShow={() => {
            onChoose({ kind: 'picked', range: dates.range });
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
      ) : null}
    </>
  );
}

/** What a list says while dates older than the phone's are read, or why they could not be. */
export type RangeTexts = { loading: string; offline: string; failed: string };

/**
 * A list's dates being read (a box with a spinner), offline (the named warning, ADR-0007 rule 6) or
 * failed, each with Try again; nothing once ready.
 */
export function RangeStatusView({ status, texts, onRetry }: { status: RangeStatus; texts: RangeTexts; onRetry(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>{texts.loading}</Text>
      </View>
    );
  }
  if (status === 'offline' || status === 'failed') {
    return (
      <View style={styles.problem}>
        <Banner tone="error" text={status === 'offline' ? texts.offline : texts.failed} {...(status === 'offline' ? { icon: WifiOff } : {})} />
        <TextButton title="Try again" onPress={onRetry} />
      </View>
    );
  }
  return null;
}

// The redesign's 5.1 as D-114 drew it (B): the choices as the app's choice blocks, the loading box
// sunken, the warning a banner with Try again under it.
const useStyles = themedStyles((c) => ({
  choicesScroll: { marginHorizontal: -16, flexGrow: 0 },
  choices: { gap: 8, paddingHorizontal: 16 },
  choice: { flexDirection: 'row', gap: 6 },
  choiceText: { fontSize: 15 },
  loading: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 4, backgroundColor: c.surfaceSunken },
  loadingText: { fontSize: 14, color: c.inkMuted },
  problem: { gap: 4, alignItems: 'flex-start' },
}));
