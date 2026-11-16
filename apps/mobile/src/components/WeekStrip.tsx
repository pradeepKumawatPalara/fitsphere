import { addDays, type IstDay } from '@fitsphere/shared';
import { Apple, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react-native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, type GestureResponderEvent } from 'react-native';
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

/** How far a finger moves sideways before the strip takes it from the day under it and from the page's scrolling. */
const SWIPE_START = 8;
/** A swipe moves a week once dragged a quarter of the week's width… */
const SWIPE_PAGE = 0.25;
/** …or flicked faster than this, in points a millisecond. */
const SWIPE_FLICK = 0.3;
/** A finger still for longer than this before it lifts did not flick. */
const FLICK_WITHIN_MS = 100;
/** How long a week takes to slide into place. */
const SLIDE_MS = 220;

/** A swipe under way: where it began, the week it began on, the row's offset then, and the finger's last place, time and speed. */
type Swipe = { x: number; week: number; offset: number; lastX: number; time: number; speed: number };

/**
 * Where a swipe goes (D-79; the owner, 2026-11-16): 1 the week after, -1 the week before, 0 back to the
 * week it began on; one week whatever the swipe's length or speed. A finger moved left (`dx` below 0)
 * brings in the week after, as a page turned. A flick's direction wins over the distance dragged.
 */
export function swipeStep(dx: number, speed: number, width: number): -1 | 0 | 1 {
  const toward = Math.abs(speed) >= SWIPE_FLICK ? speed : Math.abs(dx) >= width * SWIPE_PAGE ? dx : 0;
  if (toward < 0) return 1;
  if (toward > 0) return -1;
  return 0;
}

// The date strip (REQ-HOME-002, D-79): a week, Monday to Sunday; this week's days after today are
// greyed and cannot be picked (Q-017), as are days before `firstDay` (REQ-DATE-001), and screen
// readers hear them as "not available", as in the calendar (D-34). Today is outlined (REQ-DATE-003).
// Under each date, as in the header's calendar (D-84): a green apple when a meal is logged that day
// and a green dumbbell when a workout is (D-103, on Home, Nutrition and Training; it replaced the
// status box of Q-019 and D-65). The selected day, which every card below follows, is the filled pill.
//
// Earlier weeks sit in a row, a week a page; a swipe, "Earlier days" and "Later days" each move it
// exactly one week, however long or fast the swipe (D-79; the owner, 2026-11-16: the phone's own paging
// once ran on freely after a few quick swipes): no further back than the week holding `firstDay`, no
// further on than this week. The week follows the finger, never further than the next week; let go, it
// slides on to that week, or back. A swipe shows days without choosing one. Only the week shown is there
// for screen readers; the arrows move it.
export function WeekStrip({ today, firstDay, selected, start, activity, onSelect, onShow }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const canGoBack = addDays(start, -1) >= firstDay;
  const canGoOn = addDays(start, 7) <= today;
  const starts = stripStarts(firstDay, today);
  const shown = Math.max(0, starts.indexOf(start));
  // A page's width: the room between the arrows, known once laid out.
  const [pageWidth, setPageWidth] = useState(0);
  // The row's offset, made once (state: React reads no ref while drawing): week i shows at -i × pageWidth.
  const [slide] = useState(() => new Animated.Value(0));
  // The week the row shows, or is sliding to.
  const target = useRef(0);
  // Where the finger came down on the strip, and once it swipes, the swipe.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = useRef<Swipe | null>(null);
  // The latest weeks and `onShow`, for a slide that ends after another render.
  const latest = useRef({ starts, start, onShow });
  useEffect(() => {
    latest.current = { starts, start, onShow };
  });

  /** Slides the row to week `index`; once there, that week is shown, unless a swipe or another slide took over. */
  function slideTo(index: number) {
    target.current = index;
    Animated.timing(slide, {
      toValue: -index * pageWidth,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      const next = latest.current.starts[index];
      if (finished && next && next !== latest.current.start) latest.current.onShow(next);
    });
  }

  /** A week moved to: one week either side of the week the row shows or slides to, within the weeks there are. */
  function step(by: number) {
    if (pageWidth > 0) slideTo(Math.min(starts.length - 1, Math.max(0, target.current + by)));
    else if (by !== 0) onShow(addDays(start, 7 * by));
  }

  // Follows weeks shown another way, the calendar and "Back to today": the next week over slides, a week
  // further off shows at once.
  const follow = useEffectEvent((index: number) => {
    if (pageWidth === 0 || swipe.current || target.current === index) return;
    if (Math.abs(target.current - index) === 1) {
      slideTo(index);
      return;
    }
    target.current = index;
    slide.setValue(-index * pageWidth);
  });
  useEffect(() => {
    follow(shown);
  }, [shown, pageWidth]);

  /** The row's offset while the finger is at `x`: never past the next week either side, and with a little give past the first and last weeks. */
  function dragged(from: Swipe, x: number) {
    const home = -from.week * pageWidth;
    const offset = Math.min(home + pageWidth, Math.max(home - pageWidth, from.offset + x - from.x));
    const first = 0;
    const last = -(starts.length - 1) * pageWidth;
    if (offset > first) return first + (offset - first) / 3;
    if (offset < last) return last + (offset - last) / 3;
    return offset;
  }

  /** Let go: one week on in the swipe's direction, or back. */
  function letGo(event: GestureResponderEvent) {
    const from = swipe.current;
    swipe.current = null;
    touch.current = null;
    if (!from) return;
    const { pageX, timestamp } = event.nativeEvent;
    // A finger that stopped before it lifted did not flick.
    const speed = timestamp - from.time > FLICK_WITHIN_MS ? 0 : from.speed;
    step(swipeStep(pageX - from.x, speed, pageWidth));
  }

  /** The finger taken away (the page scrolled, a call came): back to the week the swipe began on. */
  function cancelled() {
    swipe.current = null;
    touch.current = null;
    step(0);
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
        onPress={() => step(-1)}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, !canGoBack && styles.dimmed, pressed && styles.pressed]}
      >
        <ChevronLeft size={20} strokeWidth={2.25} color={canGoBack ? colors.accent : colors.inkSubtle} />
      </Pressable>
      <View
        testID="week-pages"
        style={styles.pages}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          if (width === pageWidth) return;
          // The row starts on the week shown, before it is first drawn.
          target.current = shown;
          slide.setValue(-shown * width);
          setPageWidth(width);
        }}
        // The touch system's own handlers, as React Native's PanResponder uses them (as the Workout in
        // progress pill, D-105): a tap stays the day's; a finger that moves sideways past SWIPE_START takes
        // the strip, from the day and from the page's scrolling, and keeps it till let go.
        onTouchStart={(event) => {
          touch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        }}
        onMoveShouldSetResponder={(event) => {
          const from = touch.current;
          if (!from || pageWidth === 0) return false;
          const dx = event.nativeEvent.pageX - from.x;
          return Math.abs(dx) > SWIPE_START && Math.abs(dx) > Math.abs(event.nativeEvent.pageY - from.y);
        }}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          // A swipe during a slide carries on from where the row is.
          let offset = -target.current * pageWidth;
          slide.stopAnimation((value) => {
            offset = value;
          });
          const { pageX, timestamp } = event.nativeEvent;
          swipe.current = { x: touch.current?.x ?? pageX, week: target.current, offset, lastX: pageX, time: timestamp, speed: 0 };
          // True keeps the page's own scrolling from taking the finger (Android).
          return true;
        }}
        onResponderMove={(event) => {
          const from = swipe.current;
          if (!from) return;
          const { pageX, timestamp } = event.nativeEvent;
          if (timestamp > from.time) from.speed = (pageX - from.lastX) / (timestamp - from.time);
          from.lastX = pageX;
          from.time = timestamp;
          slide.setValue(dragged(from, pageX));
        }}
        onResponderRelease={letGo}
        onResponderTerminate={cancelled}
      >
        {pageWidth === 0 ? (
          // Until its width is known, the week shown alone.
          <View style={styles.week}>{days(start)}</View>
        ) : (
          <Animated.View testID="week-row" style={[styles.weeks, { width: starts.length * pageWidth, transform: [{ translateX: slide }] }]}>
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
          </Animated.View>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Later days"
        accessibilityState={{ disabled: !canGoOn }}
        disabled={!canGoOn}
        onPress={() => step(1)}
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
  pages: { flex: 1, overflow: 'hidden' },
  weeks: { flexDirection: 'row' },
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
