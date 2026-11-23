import { syncWindowStart } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Bell, Calendar } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { unreadCount, useNotificationsVersion } from '../local/notificationStore';
import { listEntries, mealCounts } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { greetingName } from '../profile';
import { useDataVersion, useOlderDays } from '../sync/SyncProvider';
import { monthRange } from '../sync/olderDays';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { workoutsPerDay } from '../workouts';
import { CalendarSheet, type CalendarActivity } from './CalendarSheet';
import { ProfilePhoto, useProfile } from './ProfilePhoto';
import { Text } from './ui';

// The common header of the main screens (REQ-NAV-002, REQ-HOME-001): the selected date over the
// greeting on the left; the calendar shortcut and the profile avatar on the right. The redesign's
// 2.1 (locked by the owner, 2026-11-03): the date in condensed capitals, caramel when it is today;
// the greeting under it in display capitals. The greeting uses the profile's first name, and the
// avatar its photo (REQ-ACC-011), when there are. The calendar marks the days with a meal (an apple)
// and the days with a workout (a dumbbell), and counts the month's workouts (D-84).

export function HeaderTitle() {
  const styles = useStyles();
  const { email } = useAuth();
  const profile = useProfile();
  const { today, selected } = useSelectedDay();
  const date = selected === today ? `Today · ${formatDay(selected)}` : formatDay(selected, today);
  return (
    <View style={styles.title}>
      <Text accessibilityLabel={`Selected date: ${date}`} style={[styles.date, selected === today && styles.today]}>
        {date}
      </Text>
      <Text numberOfLines={1} style={styles.name}>
        Hi, {greetingName(profile?.name, email)}
      </Text>
    </View>
  );
}

export function HeaderActions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { email } = useAuth();
  const profile = useProfile();
  const { today, selected, firstDay, select } = useSelectedDay();
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // The month the calendar shows: one before the phone's 90 days is read from the server (D-106).
  const [month, setMonth] = useState(selected.slice(0, 7));
  const local = useLocalDatabase();
  const version = useDataVersion();
  const shownMonth = monthRange(calendarOpen ? month : today.slice(0, 7));
  const monthOlder = useOlderDays(shownMonth.from, shownMonth.to, today);
  // The meals and listed workouts on the phone (D-84), read when the calendar opens; null until then.
  const [activity, setActivity] = useState<CalendarActivity | null>(null);
  // The notifications not yet read, for the bell's badge (ADR-0014); read again when the list changes.
  const notificationsVersion = useNotificationsVersion();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void unreadCount(local.state.db).then((count) => {
      if (active) setUnread(count);
    });
    return () => {
      active = false;
    };
  }, [local.state, notificationsVersion]);

  useEffect(() => {
    if (!calendarOpen || local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([mealCounts(db, firstDay, today), listEntries(db, 'workout', firstDay, today)]).then(([meals, workouts]) => {
      if (active) setActivity({ meals, workouts: workoutsPerDay(workouts) });
    });
    return () => {
      active = false;
    };
  }, [calendarOpen, local.state, firstDay, today, version]);
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Calendar"
        onPress={() => {
          setMonth(selected.slice(0, 7));
          setCalendarOpen(true);
        }}
        hitSlop={2}
        style={({ pressed }) => [styles.calendar, pressed && styles.pressed]}
      >
        <Calendar size={22} color={colors.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onPress={() => router.push('/notifications')}
        hitSlop={2}
        style={({ pressed }) => [styles.calendar, pressed && styles.pressed]}
      >
        <Bell size={22} color={colors.accent} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account"
        onPress={() => router.push('/account')}
        hitSlop={2}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ProfilePhoto mediaId={profile?.photoMediaId ?? null} name={greetingName(profile?.name, email)} size={44} />
      </Pressable>
      {calendarOpen ? (
        <CalendarSheet
          today={today}
          firstDay={firstDay}
          selected={selected}
          activity={activity}
          monthStatus={monthOlder.status}
          phoneFirstDay={syncWindowStart(today)}
          onMonth={setMonth}
          onSelect={select}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
    </View>
  );
}

// The calendar is a caramel icon on a raised square; the account is the profile photo, or the user's
// initial on a caramel square. Both 44, radius 8.
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
  // The bell's count: a small caramel square at its top-right corner.
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: c.bg,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...TYPE.tab, fontSize: 12, lineHeight: 14, letterSpacing: 0, color: c.onPrimary },
  pressed: { opacity: 0.6 },
}));
