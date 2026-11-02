import { addDays, istWeekDays, type IstDay } from '@fitsphere/shared';
import { Pressable, View } from 'react-native';
import { dayParts } from '../format';
import { themedStyles } from '../theme';
import { Text } from './ui';

type Props = {
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** The Monday of the week shown. */
  weekStart: IstDay;
  /** Days with at least one meal: their status box is filled (REQ-HOME-002; Q-019). */
  mealDays?: ReadonlySet<IstDay>;
  onSelect(day: IstDay): void;
  onWeekChange(weekStart: IstDay): void;
};

// Mon–Sun IST week (REQ-HOME-002): today in blue (REQ-DATE-003), past days selectable back to
// `firstDay` (REQ-DATE-001), future days disabled (Q-017), and a status box per day, filled when a
// meal is logged that day (Q-019). The selected day, which every card below follows, is the filled
// pill; today keeps blue text and a bar under its date.
export function WeekStrip({ today, firstDay, selected, weekStart, mealDays, onSelect, onWeekChange }: Props) {
  const styles = useStyles();
  const nextWeek = addDays(weekStart, 7);
  const canGoBack = addDays(weekStart, -1) >= firstDay;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        accessibilityState={{ disabled: !canGoBack }}
        disabled={!canGoBack}
        onPress={() => onWeekChange(addDays(weekStart, -7))}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={[styles.arrowText, !canGoBack && styles.disabledText]}>‹</Text>
      </Pressable>
      {istWeekDays(weekStart).map((day) => {
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
            style={({ pressed }) => [styles.day, pressed && styles.pressed]}
          >
            <View style={[styles.pill, isSelected && styles.selected]}>
              <Text style={[styles.weekday, isToday && styles.todayText, isSelected && styles.selectedText, outOfRange && styles.disabledText]}>
                {parts.weekday}
              </Text>
              <Text style={[styles.date, isToday && styles.todayText, isSelected && styles.selectedText, outOfRange && styles.disabledText]}>
                {parts.date}
              </Text>
              <View style={[styles.todayBar, isToday && styles.todayBarShown, isToday && isSelected && styles.todayBarOnSelected]} />
            </View>
            {mealDays ? <View testID={`status-${day}`} style={[styles.status, logged && styles.statusFilled]} /> : null}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next week"
        accessibilityState={{ disabled: nextWeek > today }}
        disabled={nextWeek > today}
        onPress={() => onWeekChange(nextWeek)}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={[styles.arrowText, nextWeek > today && styles.disabledText]}>›</Text>
      </Pressable>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { paddingHorizontal: 6, paddingVertical: 12 },
  arrowText: { fontSize: 24 },
  pressed: { opacity: 0.6 },
  day: { alignItems: 'center', width: 40, gap: 6 },
  pill: { alignItems: 'center', alignSelf: 'stretch', paddingTop: 6, paddingBottom: 5, borderRadius: 20 },
  selected: { backgroundColor: c.primary },
  weekday: { fontSize: 12, color: c.textMuted },
  date: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  todayText: { color: c.primary, fontWeight: '700' },
  selectedText: { color: c.onPrimary, fontWeight: '700' },
  disabledText: { color: c.textFaint },
  todayBar: { marginTop: 3, width: 14, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  todayBarShown: { backgroundColor: c.primary },
  todayBarOnSelected: { backgroundColor: c.onPrimary },
  status: { width: 18, height: 4, borderRadius: 2, backgroundColor: c.track },
  statusFilled: { backgroundColor: c.success },
}));
