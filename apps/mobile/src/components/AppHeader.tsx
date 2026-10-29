import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, nameFromEmail } from '../format';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { CalendarSheet } from './CalendarSheet';

// The common header of the main screens (REQ-NAV-002, REQ-HOME-001): the user's name and the
// selected date on the left; the calendar shortcut and the profile avatar on the right.

export function HeaderTitle() {
  const { email } = useAuth();
  const { today, selected } = useSelectedDay();
  const date = selected === today ? `Today · ${formatDay(selected)}` : formatDay(selected);
  return (
    <View>
      <Text style={styles.name}>Hi, {nameFromEmail(email)}</Text>
      <Text accessibilityLabel={`Selected date: ${date}`} style={styles.date}>
        {date}
      </Text>
    </View>
  );
}

export function HeaderActions() {
  const { email } = useAuth();
  const { today, selected, firstDay, select } = useSelectedDay();
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const initial = nameFromEmail(email).charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Calendar" onPress={() => setCalendarOpen(true)} style={styles.calendar}>
        <Text style={styles.calendarText}>📅</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => router.push('/account')} style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
      {calendarOpen ? (
        <CalendarSheet
          today={today}
          firstDay={firstDay}
          selected={selected}
          onSelect={select}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 13, color: '#555' },
  date: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 },
  calendar: { padding: 6 },
  calendarText: { fontSize: 20 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1565c0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
});
