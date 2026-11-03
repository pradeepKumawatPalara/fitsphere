import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, nameFromEmail } from '../format';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { CalendarSheet } from './CalendarSheet';
import { Text } from './ui';

// The common header of the main screens (REQ-NAV-002, REQ-HOME-001): the selected date over the
// greeting on the left; the calendar shortcut and the profile avatar on the right. The redesign's
// 2.1 (locked by the owner, 2026-11-03): the date in condensed capitals, caramel when it is today;
// the greeting under it in display capitals.

export function HeaderTitle() {
  const styles = useStyles();
  const { email } = useAuth();
  const { today, selected } = useSelectedDay();
  const date = selected === today ? `Today · ${formatDay(selected)}` : formatDay(selected);
  return (
    <View style={styles.title}>
      <Text accessibilityLabel={`Selected date: ${date}`} style={[styles.date, selected === today && styles.today]}>
        {date}
      </Text>
      <Text numberOfLines={1} style={styles.name}>
        Hi, {nameFromEmail(email)}
      </Text>
    </View>
  );
}

export function HeaderActions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { email } = useAuth();
  const { today, selected, firstDay, select } = useSelectedDay();
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const initial = nameFromEmail(email).charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Calendar"
        onPress={() => setCalendarOpen(true)}
        hitSlop={2}
        style={({ pressed }) => [styles.calendar, pressed && styles.pressed]}
      >
        <Calendar size={22} color={colors.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account"
        onPress={() => router.push('/account')}
        hitSlop={2}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
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

// The calendar is a caramel icon on a raised square; the account is the user's initial on a caramel
// square. Both 44, radius 8.
const useStyles = themedStyles((c) => ({
  title: { gap: 4 },
  date: { ...TYPE.label, color: c.inkMuted },
  today: { color: c.accent },
  name: TYPE.heading,
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 16 },
  calendar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...TYPE.heading, fontSize: 22, color: c.onPrimary },
  pressed: { opacity: 0.6 },
}));
