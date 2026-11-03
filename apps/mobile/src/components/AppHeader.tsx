import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { formatDay, nameFromEmail } from '../format';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { themedStyles, useTheme } from '../theme';
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
      <Text numberOfLines={1} style={styles.name}>
        Hi, {nameFromEmail(email)}
      </Text>
      <Text accessibilityLabel={`Selected date: ${date}`} style={styles.date}>
        {date}
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
        style={({ pressed }) => [styles.ring, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
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

// The calendar is a blue icon on a tinted tile (radius 12, as tiles elsewhere); the account is the
// user's initial on a blue disc inside a blue ring. Both 40 across, 44 to tap.
const useStyles = themedStyles((c) => ({
  name: { fontSize: 13, color: c.inkMuted },
  date: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 12 },
  calendar: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
}));
