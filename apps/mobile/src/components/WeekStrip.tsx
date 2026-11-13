import { addDays, type IstDay } from '@fitsphere/shared';
import { Apple, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { dayParts } from '../format';
import { stripStarts } from '../navigation/SelectedDayProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { activityStatus, type CalendarActivity } from './CalendarSheet';
import { Text } from './ui';

type Props = {
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** The Monday of the week shown. */
  start: IstDay;
  /** The week's meals and listed workouts per day (D-103): an apple and a dumbbell under the date. Null while
   * they load, and left out where nothing is marked. */
  activity?: CalendarActivity | null;
  onSelect(day: IstDay): void;
  /** Shows the week from its Monday, `start`. */
  onShow(start: IstDay): void;
};

// The date strip (REQ-HOME-002, D-79): a week, Monday to Sunday; this week's days after today are
// greyed and cannot be picked (Q-017), as are days before `firstDay` (REQ-DATE-001), and screen
// readers hear them as "not available", as in the calendar (D-34). Today is outlined (REQ-DATE-003).
// Under each date, as in the header's calendar (D-84): a green apple when a meal is logged that day
// and a green dumbbell when a workout is (D-103, on Home, Nutrition and Training; it replaced the
// status box of Q-019 and D-65). The selected day, which every card below follows, is the filled pill.
//
// Earlier weeks are pages to swipe through, a week a page, as "Earlier days" and "Later days" move: no
// further back than the week holding `firstDay`, no further on than this week. A swipe shows days
// without choosing one. Only the week shown is there for screen readers; the arrows move it.
export function WeekStrip({ today, firstDay, selected, start, activity, onSelect, onShow }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const canGoBack = addDays(start, -1) >= firstDay;
  const canGoOn = addDays(start, 7) <= today;
  const starts = stripStarts(firstDay, today);
  const shown = Math.max(0, starts.indexOf(start));
  // A page's width: the room between the arrows, known once laid out.
  const [pageWidth, setPageWidth] = useState(0);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);

  // Follows days shown another way: the arrows, the calendar, "Back to today".
  useEffect(() => {
    if (pageWidth > 0) pager.current?.scrollTo({ x: shown * pageWidth, animated: true });
  }, [shown, pageWidth]);

  function swiped(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.min(starts.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / pageWidth)));
    const next = starts[page];
    if (next && next !== start) onShow(next);
  }

  function days(first: IstDay) {
    return Array.from({ length: 7 }, (_, index) => addDays(first, index)).map((day) => {
      const parts = dayParts(day);
      const outOfRange = day > today || day < firstDay;
      const isToday = day === today;
      const isSelected = day === selected;
      const meals = outOfRange ? 0 : (activity?.meals[day] ?? 0);
      const workouts = outOfRange ? 0 : (activity?.workouts[day] ?? 0);
      const logged = meals > 0 || workouts > 0 ? `, ${activityStatus(meals, workouts)}` : '';
      return (
        <Pressable
          key={day}
          accessibilityRole="button"
          accessibilityLabel={`${parts.weekdayName} ${parts.date} ${parts.month}${isToday ? ', today' : ''}${logged}${outOfRange ? ', not available' : ''}`}
          accessibilityState={{ selected: isSelected, disabled: outOfRange }}
          disabled={outOfRange}
          onPress={() => onSelect(day)}
          style={({ pressed }) => [
            styles.day,
            isToday && !isSelected && styles.today,
            isSelected && styles.selected,
            outOfRange && styles.dimmed,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.weekday, isToday && styles.todayText, isSelected && styles.selectedText, outOfRange && styles.disabledText]}>
            {parts.weekday}
          </Text>
          <Text style={[styles.date, isToday && styles.todayText, isSelected && styles.selectedText, outOfRange && styles.disabledText]}>
            {parts.date}
          </Text>
          {activity !== undefined ? (
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
    });
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Earlier days"
        accessibilityState={{ disabled: !canGoBack }}
        disabled={!canGoBack}
        onPress={() => onShow(addDays(start, -7))}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, !canGoBack && styles.dimmed, pressed && styles.pressed]}
      >
        <ChevronLeft size={20} strokeWidth={2.25} color={canGoBack ? colors.accent : colors.inkSubtle} />
      </Pressable>
      <View testID="week-pages" style={styles.pages} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
        {pageWidth === 0 ? (
          // Until its width is known, the week shown alone.
          <View style={styles.week}>{days(start)}</View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            testID="week-scroll"
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: shown * pageWidth, y: 0 }}
            onMomentumScrollEnd={swiped}
          >
            {starts.map((first) => (
              <View
                key={first}
                importantForAccessibility={first === start ? 'auto' : 'no-hide-descendants'}
                accessibilityElementsHidden={first !== start}
                style={[styles.week, { width: pageWidth }]}
              >
                {days(first)}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Later days"
        accessibilityState={{ disabled: !canGoOn }}
        disabled={!canGoOn}
        onPress={() => onShow(addDays(start, 7))}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, !canGoOn && styles.dimmed, pressed && styles.pressed]}
      >
        <ChevronRight size={20} strokeWidth={2.25} color={canGoOn ? colors.accent : colors.inkSubtle} />
      </Pressable>
    </View>
  );
}

// The redesign's 2.3 (locked by the owner, 2026-11-03; Monday to Sunday since D-79, locked 2026-11-11): square
// days 64 tall and 4 apart, today outlined in caramel, the selected day filled, days that cannot be picked
// greyed. Since D-103 (canvas "2.3 Home · every nutrient…", B locked 2026-11-13): an apple 12 and a dumbbell
// 12 side by side in a row 12 tall under the date, green, or the selected day's ink.
const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrow: { width: 28, height: 64, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  dimmed: { opacity: 0.45 },
  pages: { flex: 1 },
  week: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 4 },
  today: { borderWidth: 2, borderColor: c.accent },
  selected: { backgroundColor: c.primary },
  weekday: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1, color: c.ink },
  date: { ...TYPE.dayNumber, fontSize: 20, lineHeight: 22 },
  todayText: { color: c.accent },
  selectedText: { color: c.onPrimary },
  disabledText: { color: c.inkSubtle },
  marks: { height: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
}));
