import { useRouter } from 'expo-router';
import { Bell, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PushControl } from '../components/PushControl';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  addNotification,
  dismissNotification,
  listNotifications,
  markAllRead,
  markRead,
  removeOldNotifications,
  useNotificationsVersion,
} from '../local/notificationStore';
import {
  actionLabel,
  CATEGORY_LABELS,
  newNotification,
  timeAgo,
  type NotificationCategory,
  type NotificationKind,
  type NotificationRow,
} from '../notifications';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

type Filter = 'all' | NotificationCategory;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'goal', label: 'Goals' },
  { key: 'nudge', label: 'Nudges' },
];

/** Three examples for trying the list while nothing makes real ones yet (development builds only). */
const SAMPLES: NotificationKind[] = ['meal_dinner', 'target_reached', 'workout_reminder'];

// The notification list (ADR-0014, docs/plans/notifications.md), opened from the header's bell. Design D:
// a card for each notification, with its type and time, a cross to dismiss it, and one button that
// opens what it is about. Unread cards have a caramel edge and a filled button; the list is read from
// this phone only, so it works offline.
export function NotificationsScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const choice = useChoiceStyles();
  const router = useRouter();
  const local = useLocalDatabase();
  const sync = useSync();
  const version = useNotificationsVersion();
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const db = local.state.status === 'ready' ? local.state.db : null;

  useEffect(() => {
    if (!db) return;
    let active = true;
    void removeOldNotifications(db, now()).then(() => listNotifications(db, filter === 'all' ? undefined : filter)).then((list) => {
      if (active) setRows(list);
    });
    return () => {
      active = false;
    };
  }, [db, filter, version, now]);

  const open = useCallback(
    (row: NotificationRow) => {
      if (db) void markRead(db, row.id, now());
      router.push(row.route as never);
    },
    [db, now, router],
  );

  const unread = (rows ?? []).filter((row) => row.readAt === null).length;
  const current = now();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PushControl now={now} />
      <View style={styles.markAll}>
        <TextButton title="Reminder settings" end onPress={() => router.push('/notification-settings')} />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Show" style={styles.filters}>
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: filter === key }}
            onPress={() => setFilter(key)}
            style={({ pressed }) => [choice.choice, filter === key && choice.chosen, pressed && choice.pressed]}
          >
            <Text style={[choice.choiceText, filter === key && choice.chosenText]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {unread > 0 ? (
        <View style={styles.markAll}>
          <TextButton title="Mark all read" end onPress={() => db && void markAllRead(db, now())} />
        </View>
      ) : null}

      {rows !== null && rows.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyTile}>
            <Bell size={26} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>No notifications.</Text>
          {__DEV__ ? (
            <TextButton
              title="Add samples (development)"
              outlined
              wide
              onPress={() => {
                if (!db) return;
                void Promise.all(SAMPLES.map((kind) => addNotification(db, newNotification(kind, sync.newId(), new Date()))));
              }}
            />
          ) : null}
        </View>
      ) : null}

      {(rows ?? []).map((row) => {
        const isNew = row.readAt === null;
        return (
          <View key={row.id} style={[styles.card, isNew && styles.cardNew]}>
            <View style={styles.cardTop}>
              <Text style={[styles.category, row.category === 'goal' && styles.goal, row.category === 'nudge' && styles.nudge]}>
                {CATEGORY_LABELS[row.category]}
              </Text>
              <Text style={styles.time}>{isNew ? 'New · ' : ''}{timeAgo(row.createdAt, current)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dismiss: ${row.title}`}
                onPress={() => db && void dismissNotification(db, row.id, now())}
                hitSlop={4}
                style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
              >
                <X size={20} strokeWidth={2.25} color={colors.inkMuted} />
              </Pressable>
            </View>
            <Text style={[styles.title, isNew && styles.titleNew]}>{row.title}</Text>
            <TextButton title={actionLabel(row.kind)} outlined strong={isNew} wide onPress={() => open(row)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 10 },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  markAll: { alignItems: 'flex-end' },
  card: { gap: 10, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  cardNew: { borderColor: c.primary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  category: { ...TYPE.label, color: c.accent },
  goal: { color: c.success },
  nudge: { color: c.inkMuted },
  time: { ...TYPE.small, flex: 1, color: c.inkMuted },
  // The cross is 44 square to touch, drawn small, with its edge in line with the card's padding.
  dismiss: { width: 44, height: 44, marginTop: -8, marginRight: -10, marginBottom: -8, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  title: { fontFamily: 'Barlow_400Regular', fontSize: 17, lineHeight: 24, color: c.ink },
  titleNew: { fontFamily: 'Barlow_500Medium' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyTile: { width: 56, height: 56, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...TYPE.small, color: c.inkMuted },
}));
