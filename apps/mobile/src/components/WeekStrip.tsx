import { addDays, type IstDay } from '@fitsphere/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { dayParts } from '../format';
import { stripStarts } from '../navigation/SelectedDayProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

type Props = {
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** The first of the 7 days shown. */
  start: IstDay;
  /** Days with at least one meal: their status box is filled (REQ-HOME-002; Q-019). */
  mealDays?: ReadonlySet<IstDay>;
  onSelect(day: IstDay): void;
  /** Shows the 7 days from `start`. */
  onShow(start: IstDay): void;
};

// The date strip (REQ-HOME-002, D-34): 7 days ending today, so no day in it lies ahead; today in blue
// (REQ-DATE-003), past days selectable back to `firstDay` (REQ-DATE-001), and a status box per day,
// filled when a meal is logged that day (Q-019). The selected day, which every card below follows,
// is the filled pill; today keeps blue text and a bar under its date.
//
// Earlier days are pages to swipe through, 7 a page, as "Earlier days" and "Later days" move: no
// further back than the 7 holding `firstDay`. A swipe shows days without choosing one. Only the 7
// shown are there for screen readers; the arrows move them.
export function WeekStrip({ today, firstDay, selected, start, mealDays, onSelect, onShow }: Props) {
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
      const logged = mealDays?.has(day) ?? false;
      return (
        <Pressable
          key={day}
          accessibilityRole="button"
          accessibilityLabel={`${parts.weekdayName} ${parts.date} ${parts.month}${isToday ? ', today' : ''}${logged ? ', meal logged' : ''}`}
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
          {mealDays ? (
            <View
              testID={`status-${day}`}
              style={[styles.status, logged && styles.statusFilled, isSelected && (logged ? styles.statusOnSelected : styles.statusOpenOnSelected)]}
            />
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
          // Until its width is known, the 7 days shown alone.
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

// The redesign's 2.3 (locked by the owner, 2026-11-03): square days 64 tall and 4 apart, today outlined
// in caramel, the selected day filled; a day with a meal has a green mark under its date.
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
  status: { width: 14, height: 4, borderRadius: 2, backgroundColor: c.track },
  statusFilled: { backgroundColor: c.success },
  statusOnSelected: { backgroundColor: c.onPrimary },
  statusOpenOnSelected: { backgroundColor: c.scrim },
}));
