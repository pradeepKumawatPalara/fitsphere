import { addDays, type IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, Modal, Pressable, View } from 'react-native';
import { formatDay } from '../format';
import { themedStyles } from '../theme';
import { CalendarSheet } from './CalendarSheet';
import { Text } from './ui';

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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            Log this meal to
          </Text>
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
                style={[styles.row, day === selected && styles.chosen]}
              >
                <Text style={styles.day}>{name}</Text>
                <Text style={styles.status}>{status}</Text>
              </Pressable>
            );
          })}
          <Button title="Another day…" onPress={() => setCalendar(true)} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = themedStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: c.background, padding: 20, gap: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  chosen: { backgroundColor: c.surfaceSelected },
  day: { fontWeight: '600' },
  status: { color: c.textMuted },
}));
