import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { PushControl } from '../components/PushControl';
import { Text, useChoiceStyles } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getReminderSettings, saveReminderSettings } from '../local/notificationStore';
import { DAILY_CAP, MEAL_SLOTS, NUDGE_MAX_DAYS, NUDGE_MIN_DAYS, QUIET_END, QUIET_START, shiftTime, timeLabel, WEEKDAYS, type MealSlot, type ReminderSettings } from '../notificationSettings';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

const SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const STEP_MINUTES = 30;

// Notifications in Settings (ADR-0014, REQ-NOT-002, REQ-NOT-005): the card that turns push on, then each
// reminder with its own switch (all off until the user turns them on) and its time. Saved on this phone
// as soon as it changes; then the goals and the inactivity nudge, and the quiet hours that apply to all.
export function NotificationSettingsScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const local = useLocalDatabase();
  const db = local.state.status === 'ready' ? local.state.db : null;
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  // The latest settings, so a tap builds on the one before it even before the screen has drawn it.
  const latest = useRef<ReminderSettings | null>(null);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void getReminderSettings(db).then((saved) => {
      if (!active) return;
      latest.current = saved;
      setSettings(saved);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const change = useCallback(
    (update: (current: ReminderSettings) => ReminderSettings) => {
      if (latest.current === null) return;
      const next = update(latest.current);
      latest.current = next;
      setSettings(next);
      if (db) void saveReminderSettings(db, next);
    },
    [db],
  );

  // The switches wait for what was saved, so a tap never changes the defaults and overwrites a choice.
  if (settings === null) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PushControl now={now} />
      </ScrollView>
    );
  }
  const current = settings;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PushControl now={now} />

      <Text style={styles.section}>Reminders</Text>
      <View style={styles.card}>
        <ReminderRow
          title="Workout reminder"
          enabled={current.workout.enabled}
          time={current.workout.time}
          onEnabled={(enabled) => change((c) => ({ ...c, workout: { ...c.workout, enabled } }))}
          onTime={(time) => change((c) => ({ ...c, workout: { ...c.workout, time } }))}
        >
          <WorkoutDays
            days={current.workout.days}
            onToggle={(day) =>
              change((c) => {
                const days = c.workout.days.includes(day) ? c.workout.days.filter((other) => other !== day) : [...c.workout.days, day];
                return { ...c, workout: { ...c.workout, days: days.sort((x, y) => x - y) } };
              })
            }
          />
        </ReminderRow>
        {MEAL_SLOTS.map((slot) => (
          <ReminderRow
            key={slot}
            title={SLOT_LABELS[slot]}
            divided
            enabled={current.meals[slot].enabled}
            time={current.meals[slot].time}
            onEnabled={(enabled) => change((c) => ({ ...c, meals: { ...c.meals, [slot]: { ...c.meals[slot], enabled } } }))}
            onTime={(time) => change((c) => ({ ...c, meals: { ...c.meals, [slot]: { ...c.meals[slot], time } } }))}
          />
        ))}
        <ReminderRow
          title="Measurements due"
          divided
          help="After 7 days without measurements."
          enabled={current.measurements.enabled}
          time={current.measurements.time}
          onEnabled={(enabled) => change((c) => ({ ...c, measurements: { ...c.measurements, enabled } }))}
          onTime={(time) => change((c) => ({ ...c, measurements: { ...c.measurements, time } }))}
        />
      </View>
      <Text style={styles.note}>A meal reminder is skipped once that meal has food. A workout reminder is skipped once the day has a workout.</Text>

      <Text style={styles.section}>Goals</Text>
      <View style={styles.card}>
        <ReminderRow
          title="Daily target reached"
          help="When you reach today's protein target."
          enabled={current.goals.dailyTarget}
          onEnabled={(dailyTarget) => change((c) => ({ ...c, goals: { ...c.goals, dailyTarget } }))}
        />
        <ReminderRow
          title="Weekly workouts reached"
          divided
          help="When this week's workouts reach your target."
          enabled={current.goals.weeklyWorkouts}
          onEnabled={(weeklyWorkouts) => change((c) => ({ ...c, goals: { ...c.goals, weeklyWorkouts } }))}
        />
      </View>

      <Text style={styles.section}>Nudges</Text>
      <View style={styles.card}>
        <ReminderRow
          title="Inactivity nudge"
          help={`After ${current.nudge.afterDays} days without opening FitSphere.`}
          enabled={current.nudge.enabled}
          time={current.nudge.time}
          onEnabled={(enabled) => change((c) => ({ ...c, nudge: { ...c.nudge, enabled } }))}
          onTime={(time) => change((c) => ({ ...c, nudge: { ...c.nudge, time } }))}
        >
          <DaysStepper
            days={current.nudge.afterDays}
            onChange={(afterDays) => change((c) => ({ ...c, nudge: { ...c.nudge, afterDays } }))}
          />
        </ReminderRow>
      </View>
      <Text style={styles.note}>
        Quiet hours: nothing is sent from {timeLabel(QUIET_START)} to {timeLabel(QUIET_END)}, and at most {DAILY_CAP} a day.
      </Text>
    </ScrollView>
  );
}

function ReminderRow({
  title,
  help,
  enabled,
  time,
  onEnabled,
  onTime,
  divided = false,
  children,
}: {
  title: string;
  help?: string;
  enabled: boolean;
  time?: string;
  onEnabled(enabled: boolean): void;
  onTime?(time: string): void;
  divided?: boolean;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, divided && styles.divided]}>
      <View style={styles.rowTop}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {help ? <Text style={styles.help}>{help}</Text> : null}
        </View>
        <Switch
          accessibilityLabel={title}
          value={enabled}
          accessibilityState={{ checked: enabled }}
          onValueChange={onEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={enabled ? colors.accent : colors.surface}
        />
      </View>
      {enabled ? (
        <View style={styles.more}>
          {children}
          {time !== undefined && onTime ? <TimeStepper title={title} time={time} onChange={onTime} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function TimeStepper({ title, time, onChange }: { title: string; time: string; onChange(time: string): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: earlier`}
        onPress={() => onChange(shiftTime(time, -STEP_MINUTES))}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Minus size={20} color={colors.ink} />
      </Pressable>
      <Text accessibilityLabel={`${title} time: ${timeLabel(time)}`} style={styles.time}>
        {timeLabel(time)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: later`}
        onPress={() => onChange(shiftTime(time, STEP_MINUTES))}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Plus size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function DaysStepper({ days, onChange }: { days: number; onChange(days: number): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nudge after: fewer days"
        onPress={() => onChange(Math.max(NUDGE_MIN_DAYS, days - 1))}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Minus size={20} color={colors.ink} />
      </Pressable>
      <Text accessibilityLabel={`Nudge after ${days} days`} style={styles.time}>
        {days} days
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nudge after: more days"
        onPress={() => onChange(Math.min(NUDGE_MAX_DAYS, days + 1))}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Plus size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function WorkoutDays({ days, onToggle }: { days: number[]; onToggle(day: number): void }) {
  const styles = useStyles();
  const choice = useChoiceStyles();
  return (
    <View accessibilityLabel="Workout days" style={styles.days}>
      {WEEKDAYS.map(({ day, short, name }) => {
        const on = days.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={name}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(day)}
            style={({ pressed }) => [choice.choice, styles.day, on && choice.chosen, pressed && choice.pressed]}
          >
            <Text style={[choice.choiceText, on && choice.chosenText]}>{short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 34, gap: 12 },
  section: { ...TYPE.label, color: c.inkMuted, marginTop: 8 },
  card: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Barlow_500Medium', fontSize: 16, lineHeight: 22, color: c.ink },
  help: { ...TYPE.small, color: c.inkMuted },
  more: { gap: 12 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  time: { ...TYPE.metric, minWidth: 96, textAlign: 'center', color: c.ink },
  note: { ...TYPE.small, color: c.inkSubtle },
}));
