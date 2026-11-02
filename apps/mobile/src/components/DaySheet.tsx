import { addDays, type IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDay } from '../format';
import { themedStyles } from '../theme';
import { CalendarSheet } from './CalendarSheet';
import { Sheet } from './Sheet';
import { Text, TextButton } from './ui';

type Props = {
  today: IstDay;
  /** The earliest day that can be chosen (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  /** Meals logged per day, for the status of each day. */
  counts: Readonly<Record<IstDay, number>>;
  onSelect(day: IstDay): void;
  onClose(): void;
};

/** "Nothing logged", "1 meal logged" or "N meals logged" (Q-037). */
export function dayStatus(count: number): string {
  if (count === 0) return 'Nothing logged';
  return count === 1 ? '1 meal logged' : `${count} meals logged`;
}

// "Log this meal to" (REQ-LOG-002): today, yesterday and the five days before, each with its
// status, and "Another day…" for the calendar.
export function DaySheet({ today, firstDay, selected, counts, onSelect, onClose }: Props) {
  const styles = useStyles();
  const [calendar, setCalendar] = useState(false);
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, -index)).filter((day) => day >= firstDay);

  if (calendar) {
    return (
      <CalendarSheet
        today={today}
        firstDay={firstDay}
        selected={selected}
        onSelect={onSelect}
        onClose={() => {
          setCalendar(false);
          onClose();
        }}
      />
    );
  }

  // In the sheets' frame, which keeps Cancel clear of the navigation bar.
  return (
    <Sheet title="Log this meal to" onClose={onClose} actions={<TextButton title="Cancel" onPress={onClose} />}>
      <View style={styles.days}>
        {days.map((day, index) => {
          const name = index === 0 ? `Today, ${formatDay(day)}` : index === 1 ? `Yesterday, ${formatDay(day)}` : formatDay(day);
          const status = dayStatus(counts[day] ?? 0);
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${name}: ${status}`}
              accessibilityState={{ selected: day === selected }}
              onPress={() => {
                onSelect(day);
                onClose();
              }}
              style={({ pressed }) => [styles.row, day === selected && styles.chosen, pressed && styles.pressed]}
            >
              <Text style={styles.day}>{name}</Text>
              <Text style={styles.status}>{status}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextButton title="Another day…" onPress={() => setCalendar(true)} />
    </Sheet>
  );
}

// Rows 48 tall; the chosen day is tinted, as a chosen row elsewhere.
const useStyles = themedStyles((c) => ({
  days: { gap: 2 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  chosen: { backgroundColor: c.surfaceSelected },
  pressed: { opacity: 0.6 },
  day: { fontSize: 15, fontWeight: '600' },
  status: { fontSize: 13, color: c.textMuted },
}));
