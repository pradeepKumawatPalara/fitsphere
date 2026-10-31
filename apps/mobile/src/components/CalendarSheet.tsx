import type { IstDay } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, Modal, Pressable, View } from 'react-native';
import { addMonths, formatLongDay, formatMonth, monthWeeks } from '../format';
import { themedStyles } from '../theme';
import { Text } from './ui';

type Props = {
  today: IstDay;
  /** The earliest day that can be picked (the phone's 90 days; MVP default, D-23). */
  firstDay: IstDay;
  selected: IstDay;
  onSelect(day: IstDay): void;
  onClose(): void;
};

const WEEKDAY_HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// The header's calendar shortcut (REQ-NAV-002): a month grid that opens on the selected month.
// Future days (Q-017) and days before `firstDay` cannot be picked.
export function CalendarSheet({ today, firstDay, selected, onSelect, onClose }: Props) {
  const styles = useStyles();
  const [month, setMonth] = useState(selected.slice(0, 7));
  const canGoBack = month > firstDay.slice(0, 7);
  const canGoForward = month < today.slice(0, 7);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              accessibilityState={{ disabled: !canGoBack }}
              disabled={!canGoBack}
              onPress={() => setMonth(addMonths(month, -1))}
              style={styles.arrow}
            >
              <Text style={[styles.arrowText, !canGoBack && styles.disabledText]}>‹</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              {formatMonth(month)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: !canGoForward }}
              disabled={!canGoForward}
              onPress={() => setMonth(addMonths(month, 1))}
              style={styles.arrow}
            >
              <Text style={[styles.arrowText, !canGoForward && styles.disabledText]}>›</Text>
            </Pressable>
          </View>
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
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatLongDay(day)}${day === today ? ', today' : ''}`}
                    accessibilityState={{ selected: isSelected, disabled }}
                    disabled={disabled}
                    onPress={() => {
                      onSelect(day);
                      onClose();
                    }}
                    style={[styles.cell, styles.day, day === today && styles.today, isSelected && styles.selected]}
                  >
                    <Text style={[day === today && styles.todayText, disabled && styles.disabledText]}>
                      {Number(day.slice(8))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Button title="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = themedStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: c.background, padding: 16, gap: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '600' },
  arrow: { paddingHorizontal: 16, paddingVertical: 8 },
  arrowText: { fontSize: 22 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  heading: { color: c.textMuted, textAlign: 'center' },
  day: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  today: { backgroundColor: c.primary },
  todayText: { color: c.onPrimary, fontWeight: '700' },
  selected: { borderColor: c.primaryStrong },
  disabledText: { color: c.textFaint },
}));
