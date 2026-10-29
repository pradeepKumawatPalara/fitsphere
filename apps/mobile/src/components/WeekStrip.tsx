import { addDays, istWeekDays, type IstDay } from '@fitsphere/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayParts } from '../format';

type Props = {
  today: IstDay;
  selected: IstDay;
  /** The Monday of the week shown. */
  weekStart: IstDay;
  onSelect(day: IstDay): void;
  onWeekChange(weekStart: IstDay): void;
};

// Mon–Sun IST week (REQ-HOME-002): today in blue (REQ-DATE-003), past days selectable
// (REQ-DATE-001), future days disabled (Q-017).
export function WeekStrip({ today, selected, weekStart, onSelect, onWeekChange }: Props) {
  const nextWeek = addDays(weekStart, 7);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        onPress={() => onWeekChange(addDays(weekStart, -7))}
        style={styles.arrow}
      >
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      {istWeekDays(weekStart).map((day) => {
        const parts = dayParts(day);
        const future = day > today;
        const isToday = day === today;
        const isSelected = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${parts.weekdayName} ${parts.date} ${parts.month}${isToday ? ', today' : ''}`}
            accessibilityState={{ selected: isSelected, disabled: future }}
            disabled={future}
            onPress={() => onSelect(day)}
            style={[styles.day, isToday && styles.today, isSelected && styles.selected]}
          >
            <Text style={[styles.dayText, isToday && styles.todayText, future && styles.futureText]}>{parts.weekday}</Text>
            <Text style={[styles.dayText, isToday && styles.todayText, future && styles.futureText]}>{parts.date}</Text>
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
        <Text style={[styles.arrowText, nextWeek > today && styles.futureText]}>›</Text>
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
  futureText: { color: '#bbb' },
});
