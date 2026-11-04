import type { IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { addMonths, formatLongDay, formatMonth, monthWeeks } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
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
  const { colors } = useTheme();
  const [month, setMonth] = useState(selected.slice(0, 7));
  // Why the greyed day just tapped cannot be picked.
  const [notice, setNotice] = useState<string | null>(null);
  const canGoBack = month > firstDay.slice(0, 7);
  const canGoForward = month < addMonths(today.slice(0, 7), MONTHS_AHEAD);

  function showMonth(next: string) {
    setMonth(next);
    setNotice(null);
  }

  // In the sheets' frame (the redesign's 2.2, locked by the owner 2026-11-03): the month in display
  // capitals, under Log meal's title; square days, today outlined in caramel, the selected day
  // filled; greyed days dimmed.
  return (
    <Sheet
      onClose={onClose}
      header={
        <View style={styles.monthRow}>
          <View style={styles.monthTitle}>
            {title ? (
              <Text accessibilityRole="header" style={styles.overline}>
                {title}
              </Text>
            ) : null}
            <Text accessibilityRole="header" style={styles.title}>
              {formatMonth(month)}
            </Text>
          </View>
          <View style={styles.arrows}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              accessibilityState={{ disabled: !canGoBack }}
              disabled={!canGoBack}
              onPress={() => showMonth(addMonths(month, -1))}
              style={({ pressed }) => [styles.arrow, !canGoBack && styles.dimmed, pressed && styles.pressed]}
            >
              <ChevronLeft size={22} strokeWidth={2.25} color={canGoBack ? colors.accent : colors.inkSubtle} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: !canGoForward }}
              disabled={!canGoForward}
              onPress={() => showMonth(addMonths(month, 1))}
              style={({ pressed }) => [styles.arrow, !canGoForward && styles.dimmed, pressed && styles.pressed]}
            >
              <ChevronRight size={22} strokeWidth={2.25} color={canGoForward ? colors.accent : colors.inkSubtle} />
            </Pressable>
          </View>
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
                  style={({ pressed }) => [
                    styles.cell,
                    styles.day,
                    isToday && !isSelected && styles.today,
                    isSelected && styles.selected,
                    disabled && styles.dimmed,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.date, isToday && styles.todayText, isSelected && styles.selectedText, disabled && styles.disabledText]}>
                    {Number(day.slice(8))}
                  </Text>
                  {counts ? <View style={[styles.dot, count > 0 && styles.dotShown, count > 0 && isSelected && styles.dotOnSelected]} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {notice ? (
        <View style={styles.notice}>
          <CircleAlert size={16} color={colors.danger} />
          <Text accessibilityRole="alert" style={styles.noticeText}>
            {notice}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

// Days 44 tall with 4 between them; the arrows 44 square, raised, radius 8.
const useStyles = themedStyles((c) => ({
  monthRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  monthTitle: { flexShrink: 1, gap: 4 },
  overline: { ...TYPE.label, color: c.inkMuted },
  title: TYPE.sheetTitle,
  arrows: { flexDirection: 'row', gap: 8 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  dimmed: { opacity: 0.45 },
  month: { gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, alignItems: 'center' },
  heading: { ...TYPE.label, paddingVertical: 4, color: c.inkMuted, textAlign: 'center' },
  day: { height: 44, justifyContent: 'center', gap: 2, borderRadius: 4 },
  today: { borderWidth: 2, borderColor: c.accent },
  selected: { backgroundColor: c.primary },
  date: TYPE.dayNumber,
  todayText: { color: c.accent },
  selectedText: { color: c.onPrimary },
  disabledText: { color: c.inkSubtle },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noticeText: { ...TYPE.small, flexShrink: 1, color: c.danger, textAlign: 'center' },
  // A day with a meal, in the green of the week strip's filled status.
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'transparent' },
  dotShown: { backgroundColor: c.success },
  dotOnSelected: { backgroundColor: c.onPrimary },
}));
