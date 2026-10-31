import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, nameFromEmail } from '../format';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { themedStyles } from '../theme';
import { CalendarSheet } from './CalendarSheet';
import { Text } from './ui';

// The common header of the main screens (REQ-NAV-002, REQ-HOME-001): the user's name and the
// selected date on the left; the calendar shortcut and the profile avatar on the right.

export function HeaderTitle() {
  const styles = useStyles();
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
  const styles = useStyles();
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

const useStyles = themedStyles((c) => ({
  name: { fontSize: 13, color: c.textMuted },
  date: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 },
  calendar: { padding: 6 },
  calendarText: { fontSize: 20 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.onPrimary, fontWeight: '700' },
}));
