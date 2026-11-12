import type { IstDay } from '@fitsphere/shared';
import { Check, Info, Pause, Play } from 'lucide-react-native';
import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { formatDay } from '../format';
import { formatDuration, spokenDuration } from '../workouts';
import { Text, TextButton } from './ui';

/** Another workout whose timer runs or is paused (D-83): one timer at a time. */
export type OtherTimer = { name: string; day: IstDay; running: boolean };

/**
 * Why a timer cannot start (D-83, the owner, 2026-11-12: "if the one wrkout timer is running user
 * should not be able to start a New work work"): the other workout's timer, and a link to it.
 */
export function OtherTimerNote({ other, onOpen }: { other: OtherTimer; onOpen(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={styles.note}>
      <Info size={18} color={colors.warning} />
      <View style={styles.noteWords}>
        <Text style={styles.noteText}>
          {`Another workout's timer is ${other.running ? 'running' : 'paused'}: ${other.name} · ${formatDay(other.day)}. Mark it done to start this one.`}
        </Text>
        <TextButton title={`Open ${other.name}`} onPress={onOpen} />
      </View>
    </View>
  );
}

/**
 * The workout timer's bar at the foot of a workout (D-71): "Start workout" on a workout of today
 * whose timer has not started; then the time counted, a "Running" or "Paused" tag, Pause or Resume,
 * and "Mark done". A timer marked done shows no bar: the workout's screen shows its total instead.
 * While another workout's timer runs or is paused, Start workout is greyed, with why (D-83).
 */
export function WorkoutTimerBar({
  state,
  seconds,
  busy,
  other = null,
  onOpenOther,
  onStart,
  onPause,
  onResume,
  onDone,
}: {
  state: 'none' | 'running' | 'paused';
  seconds: number;
  /** A step being saved: the buttons wait for it. */
  busy: boolean;
  /** Another workout's timer going, which keeps this one from starting (D-83). */
  other?: OtherTimer | null;
  onOpenOther?(): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onDone(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const running = state === 'running';

  if (state === 'none') {
    return (
      <View style={[styles.bar, { paddingBottom: 16 + bottom }]}>
        {other ? <OtherTimerNote other={other} onOpen={() => onOpenOther?.()} /> : null}
        <TextButton title="Start workout" filled icon={Play} disabled={busy || other !== null} onPress={onStart} />
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: 16 + bottom }]}>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>Workout time</Text>
          <Text
            accessibilityRole="timer"
            accessibilityLabel={`Workout time ${spokenDuration(seconds)}${running ? '' : ', paused'}`}
            style={styles.time}
          >
            {formatDuration(seconds)}
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: running ? colors.successTint : colors.warningTint }]}>
          {running ? <View style={styles.dot} /> : <Pause size={14} color={colors.warning} fill={colors.warning} />}
          <Text style={[styles.tagText, { color: running ? colors.success : colors.warning }]}>{running ? 'Running' : 'Paused'}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.half}>
          {running ? (
            <TextButton title="Pause" outlined wide icon={Pause} disabled={busy} onPress={onPause} />
          ) : (
            <TextButton title="Resume" outlined wide icon={Play} disabled={busy} onPress={onResume} />
          )}
        </View>
        <View style={styles.half}>
          <TextButton title="Mark done" filled wide icon={Check} disabled={busy} onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

// The redesign's 4.2 with the timer, as locked by the owner on 2026-11-10 (D-71): a bar on the card
// colour above a rule; the time in big condensed figures under a muted label, a green "Running" tag
// with a dot or a gold "Paused" one with the pause sign; Pause or Resume outlined and Mark done filled,
// the same size side by side; before the start, Start workout filled across the bar.
const useStyles = themedStyles((c) => ({
  // D-83: why Start workout is greyed, in the warning's colours.
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 4, backgroundColor: c.warningTint },
  noteWords: { flex: 1, alignItems: 'flex-start', gap: 2 },
  noteText: { fontSize: 15, lineHeight: 21, color: c.ink },
  bar: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  label: { ...TYPE.label, color: c.inkMuted },
  time: { ...TYPE.display, fontSize: 56, lineHeight: 58, fontVariant: ['tabular-nums'] },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 30, marginBottom: 8, paddingHorizontal: 10, borderRadius: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  tagText: { ...TYPE.link, fontSize: 14, letterSpacing: 1.2 },
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
}));
