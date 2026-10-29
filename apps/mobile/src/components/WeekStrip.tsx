import { addDays, istWeekDays, type IstDay } from '@fitsphere/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayParts } from '../format';

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
// meal is logged that day (Q-019).
export function WeekStrip({ today, firstDay, selected, weekStart, mealDays, onSelect, onWeekChange }: Props) {
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
        style={styles.arrow}
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
            style={[styles.day, isToday && styles.today, isSelected && styles.selected]}
          >
            <Text style={[styles.dayText, isToday && styles.todayText, outOfRange && styles.disabledText]}>{parts.weekday}</Text>
            <Text style={[styles.dayText, isToday && styles.todayText, outOfRange && styles.disabledText]}>{parts.date}</Text>
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
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, nextWeek > today && styles.disabledText]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { paddingHorizontal: 8, paddingVertical: 12 },
  arrowText: { fontSize: 22 },
  day: { alignItems: 'center', paddingVertical: 6, width: 40, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  today: { backgroundColor: '#1565c0' },
  selected: { borderColor: '#0d47a1' },
  dayText: { fontSize: 13 },
  todayText: { color: '#fff', fontWeight: '700' },
  disabledText: { color: '#bbb' },
  status: { marginTop: 3, width: 10, height: 10, borderRadius: 2, borderWidth: 1, borderColor: '#90a4ae' },
  statusFilled: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
});
