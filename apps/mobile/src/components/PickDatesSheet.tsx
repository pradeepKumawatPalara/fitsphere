import type { IstDay } from '@fitsphere/shared';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { rangeYears, yearRange, type DayRange } from '../dateRange';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { DATES_TEXTS } from './DatesSheet';
import { Sheet } from './Sheet';
import { Text, TextButton, useChoiceStyles } from './ui';

type Props = {
  from: IstDay;
  to: IstDay;
  today: IstDay;
  /** What loads online, e.g. "Weeks older than 90 days load online." */
  online: string;
  /** Opens the calendar for From or To (Start date to end date). */
  onChange(end: 'from' | 'to'): void;
  /** Show: the years' dates, or none for the dates already chosen. */
  onShow(range?: DayRange): void;
  onClose(): void;
};

type Mode = 'dates' | 'years';

/** What the sheet says (the owner's B, 2026-11-18). */
export const PICK_TEXTS = {
  dates: 'Start date to end date',
  years: 'Start year to end year',
  yearsRule: 'Whole years: 1 January of the first to 31 December of the last.',
  wrongOrder: 'To year can’t be before From year.',
  show: 'Show these weeks',
} as const;

// Pick dates, two ways (the owner's B on the canvas, 2026-11-18): a start date and an end date, each
// opening the calendar (from 1 Jan 2000 to today); or a start year and an end year from two lists.
// A summary line says what will show; Show is greyed while the years are the wrong way round.
export function PickDatesSheet({ from, to, today, online, onChange, onShow, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const years = rangeYears(today);
  const [mode, setMode] = useState<Mode>('dates');
  const [fromYear, setFromYear] = useState(() => Math.max(Number(from.slice(0, 4)), years[years.length - 1]!));
  const [toYear, setToYear] = useState(() => Number(to.slice(0, 4)));
  const wrongOrder = mode === 'years' && toYear < fromYear;
  const yearsShown = wrongOrder ? null : { from: yearRange(fromYear, today).from, to: yearRange(toYear, today).to };
  const count = toYear - fromYear + 1;

  const ends = [
    { end: 'from' as const, label: 'From', day: from },
    { end: 'to' as const, label: 'To', day: to },
  ];

  const lists = [
    { key: 'from', label: 'From year', chosen: fromYear, set: setFromYear },
    { key: 'to', label: 'To year', chosen: toYear, set: setToYear },
  ];

  return (
    <Sheet
      title={DATES_TEXTS.title}
      scroll={false}
      onClose={onClose}
      actions={
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextButton title="Cancel" outlined wide onPress={onClose} />
          </View>
          <View style={styles.half}>
            <TextButton
              title={PICK_TEXTS.show}
              outlined
              strong
              wide
              disabled={wrongOrder}
              onPress={() => (mode === 'years' && yearsShown ? onShow(yearsShown) : onShow())}
            />
          </View>
        </View>
      }
    >
      <View style={styles.modes}>
        {(['dates', 'years'] as const).map((option) => {
          const selected = option === mode;
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityLabel={PICK_TEXTS[option]}
              accessibilityState={{ selected }}
              onPress={() => setMode(option)}
              style={({ pressed }) => [pill.choice, styles.mode, selected && pill.chosen, pressed && pill.pressed]}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[pill.choiceText, selected && pill.chosenText]}>
                {PICK_TEXTS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.muted}>{online}</Text>

      {mode === 'dates' ? (
        <>
          <View style={styles.ends}>
            {ends.map(({ end, label, day }) => (
              <View key={end} style={styles.end}>
                <Text style={styles.label}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: ${formatDay(day, today)}. Change`}
                  onPress={() => onChange(end)}
                  style={({ pressed }) => [styles.box, pressed && styles.pressed]}
                >
                  <Calendar size={18} strokeWidth={2.25} color={colors.accent} />
                  <Text style={styles.day} numberOfLines={1}>
                    {formatDay(day, today)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={styles.small}>{DATES_TEXTS.rule}</Text>
        </>
      ) : (
        <>
          <View style={styles.lists}>
            {lists.map(({ key, label, chosen, set }) => (
              <View key={key} style={styles.listColumn}>
                <Text style={styles.label}>{label}</Text>
                <ScrollView
                  accessibilityLabel={label}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  contentContainerStyle={styles.listBody}
                >
                  {years.map((year) => {
                    const selected = year === chosen;
                    return (
                      <Pressable
                        key={year}
                        accessibilityRole="radio"
                        accessibilityLabel={`${label} ${year}`}
                        accessibilityState={{ checked: selected }}
                        onPress={() => set(year)}
                        style={({ pressed }) => [styles.year, selected && styles.yearChosen, pressed && styles.pressed]}
                      >
                        <Text style={[styles.yearText, selected && styles.yearTextChosen]}>{year}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </View>
          {yearsShown ? (
            <Text style={styles.small}>{`${count} ${count === 1 ? 'year' : 'years'} · ${formatDay(yearsShown.from, today)} – ${formatDay(yearsShown.to, today)}. ${PICK_TEXTS.yearsRule}`}</Text>
          ) : (
            <Text accessibilityLiveRegion="polite" style={[styles.small, styles.problem]}>
              {PICK_TEXTS.wrongOrder}
            </Text>
          )}
        </>
      )}
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  muted: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  ends: { flexDirection: 'row', gap: 10 },
  end: { flex: 1, gap: 6 },
  label: { ...TYPE.label, fontSize: 13, lineHeight: 16, letterSpacing: 1.5, color: c.inkMuted },
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  pressed: { opacity: 0.6 },
  day: { flexShrink: 1, fontSize: 15, color: c.ink },
  small: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  problem: { color: c.danger },
  lists: { flexDirection: 'row', gap: 10 },
  listColumn: { flex: 1, minWidth: 0, gap: 6 },
  list: { height: 224, borderRadius: 4, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surfaceRaised },
  listBody: { padding: 4, gap: 2 },
  year: { height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  yearChosen: { backgroundColor: c.primary },
  yearText: { fontSize: 17, fontVariant: ['tabular-nums'], color: c.ink },
  yearTextChosen: { color: c.onPrimary, fontWeight: '700' },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
}));
