import type { IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { addMonths, formatLongDay, formatMonth, monthWeeks } from '../format';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextButton } from './ui';

type Props = {
  /** Above the month, e.g. "Log this meal to"; the header's calendar has none. */
  title?: string;
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** Meals logged per day (Log meal): a dot under each day with a meal, and each day's status. */
  counts?: Readonly<Record<IstDay, number>>;
  onSelect(day: IstDay): void;
  onClose(): void;
};

/** "Nothing logged", "1 meal logged" or "N meals logged" (Q-037). */
export function dayStatus(count: number): string {
  if (count === 0) return 'Nothing logged';
  return count === 1 ? '1 meal logged' : `${count} meals logged`;
}

const WEEKDAY_HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** How far ahead the calendar browses (D-34). */
const MONTHS_AHEAD = 12;
// What a greyed day says when tapped (D-34).
export const FUTURE_DAY = "Future dates can't be chosen. Choose today or an earlier day.";
export const OLDER_DAY = 'Only the last 90 days are on this phone. Choose a later day.';

// The header's calendar shortcut (REQ-NAV-002), and Log meal's date (REQ-LOG-002, D-33): a month
// grid that opens on the selected month and browses back to `firstDay`'s month and up to 12 months
// ahead (D-34). Future days (Q-017) and days before `firstDay` are greyed and cannot be picked:
// tapping one says why, and screen readers hear "not available". With `counts`, each day with a meal
// has a dot, and each day's status (Q-037) is read out.
export function CalendarSheet({ title, today, firstDay, selected, counts, onSelect, onClose }: Props) {
  const styles = useStyles();
  const [month, setMonth] = useState(selected.slice(0, 7));
  // Why the greyed day just tapped cannot be picked.
  const [notice, setNotice] = useState<string | null>(null);
  const canGoBack = month > firstDay.slice(0, 7);
  const canGoForward = month < addMonths(today.slice(0, 7), MONTHS_AHEAD);

  function showMonth(next: string) {
    setMonth(next);
    setNotice(null);
  }

  // In the sheets' frame. Days as on the week strip: the selected day a filled pill, today in blue
  // with a bar under it.
  return (
    <Sheet
      title={title}
      onClose={onClose}
      header={
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: !canGoBack }}
            disabled={!canGoBack}
            onPress={() => showMonth(addMonths(month, -1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={[styles.arrowText, !canGoBack && styles.disabledText]}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {formatMonth(month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !canGoForward }}
            disabled={!canGoForward}
            onPress={() => showMonth(addMonths(month, 1))}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={[styles.arrowText, !canGoForward && styles.disabledText]}>›</Text>
          </Pressable>
        </View>
      }
      actions={<TextButton title="Close" wide onPress={onClose} />}
    >
      <View style={styles.month}>
        <View style={styles.week}>
          {WEEKDAY_HEADINGS.map((heading, index) => (
            <Text key={index} style={[styles.cell, styles.heading]}>
              {heading}
            </Text>
          ))}
        </View>
        {monthWeeks(month).map((week, index) => (
          <View key={index} style={styles.week}>
            {week.map((day, column) => {
              if (!day) return <View key={column} style={styles.cell} />;
              const disabled = day > today || day < firstDay;
              const isSelected = day === selected;
              const isToday = day === today;
              const count = counts?.[day] ?? 0;
              const status = disabled ? ', not available' : counts ? `, ${dayStatus(count)}` : '';
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatLongDay(day)}${day === today ? ', today' : ''}${status}`}
                  accessibilityState={{ selected: isSelected, disabled }}
                  onPress={() => {
                    if (day > today) setNotice(FUTURE_DAY);
                    else if (day < firstDay) setNotice(OLDER_DAY);
                    else {
                      onSelect(day);
                      onClose();
                    }
                  }}
                  style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                >
                  <View style={[styles.day, isSelected && styles.selected]}>
                    <Text style={[styles.date, isToday && styles.todayText, isSelected && styles.selectedText, disabled && styles.disabledText]}>
                      {Number(day.slice(8))}
                    </Text>
                    <View style={[styles.todayBar, isToday && styles.todayBarShown, isToday && isSelected && styles.todayBarOnSelected]} />
                    {counts ? <View style={[styles.dot, count > 0 && styles.dotShown, count > 0 && isSelected && styles.dotOnSelected]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600' },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 24 },
  pressed: { opacity: 0.6 },
  month: { gap: 4 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  heading: { paddingVertical: 4, fontSize: 12, color: c.textMuted, textAlign: 'center' },
  day: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  selected: { backgroundColor: c.primary },
  date: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  todayText: { color: c.primary, fontWeight: '700' },
  selectedText: { color: c.onPrimary, fontWeight: '700' },
  disabledText: { color: c.textFaint },
  todayBar: { marginTop: 2, width: 14, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  todayBarShown: { backgroundColor: c.primary },
  todayBarOnSelected: { backgroundColor: c.onPrimary },
  notice: { fontSize: 13, color: c.error, textAlign: 'center' },
  // A day with a meal, in the green of the week strip's filled status.
  dot: { marginTop: 2, width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'transparent' },
  dotShown: { backgroundColor: c.success },
  dotOnSelected: { backgroundColor: c.onPrimary },
}));
