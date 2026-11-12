import type { IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { Apple, ChevronLeft, ChevronRight, CircleAlert, Dumbbell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { addMonths, formatLongDay, formatMonth, monthWeeks } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Text, TextButton } from './ui';

/** Meals and listed workouts per day, for the header's calendar (D-84). */
export type CalendarActivity = {
  meals: Readonly<Record<IstDay, number>>;
  workouts: Readonly<Record<IstDay, number>>;
};

type Props = {
  /** Above the month, e.g. "Log this meal to"; the header's calendar has none. */
  title?: string;
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** Meals logged per day (Log meal): a dot under each day with a meal, and each day's status. */
  counts?: Readonly<Record<IstDay, number>>;
  /**
   * The header's calendar (D-84): a day with a meal has a green apple (the Nutrition tab's icon) under
   * its date, a day with a workout a green dumbbell, the month's workouts are counted under its name, and a key sits under the
   * days. `null` while they load: the same layout, nothing marked yet.
   */
  activity?: CalendarActivity | null;
  onSelect(day: IstDay): void;
  onClose(): void;
};

/** "Nothing logged", "1 meal logged" or "N meals logged" (Q-037). */
export function dayStatus(count: number): string {
  if (count === 0) return 'Nothing logged';
  return count === 1 ? '1 meal logged' : `${count} meals logged`;
}

/** "No workouts", "1 workout" or "N workouts": the month's, under its name (D-84). */
export function monthWorkoutsText(count: number): string {
  if (count === 0) return 'No workouts';
  return count === 1 ? '1 workout' : `${count} workouts`;
}

/** What a day of the header's calendar says to screen readers (D-84): its meals and its workouts. */
export function activityStatus(meals: number, workouts: number): string {
  const parts: string[] = [];
  if (meals > 0) parts.push(dayStatus(meals));
  if (workouts > 0) parts.push(workouts === 1 ? '1 workout logged' : `${workouts} workouts logged`);
  return parts.length > 0 ? parts.join(', ') : 'Nothing logged';
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
// tapping one says why, and screen readers hear "not available". With `counts` (Log meal), each day
// with a meal has a dot, and each day's status (Q-037) is read out. With `activity` (the header's,
// D-84, canvas "2.2 Calendar · an apple for meals", B locked), a day with a meal has a green apple and
// a day with a workout a green dumbbell, side by side under the date; the month's workouts are counted under its name, with a key below.
export function CalendarSheet({ title, today, firstDay, selected, counts, activity, onSelect, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [month, setMonth] = useState(selected.slice(0, 7));
  // Why the greyed day just tapped cannot be picked.
  const [notice, setNotice] = useState<string | null>(null);
  const canGoBack = month > firstDay.slice(0, 7);
  const canGoForward = month < addMonths(today.slice(0, 7), MONTHS_AHEAD);
  const marking = activity !== undefined;
  // The month's listed workouts (D-84); none counted while they load.
  const monthWorkouts = activity
    ? Object.entries(activity.workouts).reduce((sum, [day, count]) => (day.startsWith(`${month}-`) ? sum + count : sum), 0)
    : null;

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
            {marking ? (
              <View style={styles.monthCount}>
                {monthWorkouts !== null ? (
                  <>
                    <Dumbbell size={14} strokeWidth={2.25} color={colors.success} />
                    <Text style={styles.monthCountText}>{monthWorkoutsText(monthWorkouts)}</Text>
                  </>
                ) : null}
              </View>
            ) : null}
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
              const meals = activity && !disabled ? (activity.meals[day] ?? 0) : 0;
              const workouts = activity && !disabled ? (activity.workouts[day] ?? 0) : 0;
              const status = disabled
                ? ', not available'
                : counts
                  ? `, ${dayStatus(count)}`
                  : activity
                    ? `, ${activityStatus(meals, workouts)}`
                    : '';
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
                  {marking ? (
                    <View style={styles.marks}>
                      {meals > 0 ? (
                        <View testID={`meals-${day}`}>
                          <Apple size={12} strokeWidth={2.6} color={isSelected ? colors.onPrimary : colors.success} />
                        </View>
                      ) : null}
                      {workouts > 0 ? (
                        <View testID={`workout-${day}`}>
                          <Dumbbell size={12} strokeWidth={2.6} color={isSelected ? colors.onPrimary : colors.success} />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {marking ? (
        <View accessible accessibilityLabel="Key: an apple marks meals logged; a dumbbell marks a workout" style={styles.key}>
          <View style={styles.keyItem}>
            <Apple size={14} strokeWidth={2.4} color={colors.success} />
            <Text style={styles.keyText}>Meals logged</Text>
          </View>
          <View style={styles.keyItem}>
            <Dumbbell size={14} strokeWidth={2.4} color={colors.success} />
            <Text style={styles.keyText}>Workout</Text>
          </View>
        </View>
      ) : null}
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
  // The month's workouts (D-84): kept 20 tall while they load, so the days do not move.
  monthCount: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthCountText: { ...TYPE.small, color: c.inkMuted },
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
  // The header's calendar (D-84): the apple's and the dumbbell's row 12 tall on every day, so the dates
  // line up; the key under a rule.
  marks: { height: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  key: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyText: { ...TYPE.small, color: c.inkMuted },
}));
