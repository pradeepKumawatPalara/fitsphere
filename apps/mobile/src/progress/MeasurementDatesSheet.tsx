import type { IstDay } from '@fitsphere/shared';
import { Calendar } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

type Props = {
  from: IstDay;
  to: IstDay;
  today: IstDay;
  /** Opens the calendar for From or To. */
  onChange(end: 'from' | 'to'): void;
  onShow(): void;
  onClose(): void;
};

/** What the dates sheet says (D-114). */
export const DATES_TEXTS = {
  title: 'Pick dates',
  online: 'Measurements older than 90 days load online.',
  rule: 'Any dates from 1 Jan 2000 to today. Each opens the calendar.',
} as const;

// Progress › Measurements › Pick dates (D-114, the owner's B on the canvas): From and To, each opening
// the calendar (from 1 Jan 2000 to today), then Show; Cancel leaves the list as it was.
export function MeasurementDatesSheet({ from, to, today, onChange, onShow, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ends = [
    { end: 'from' as const, label: 'From', day: from },
    { end: 'to' as const, label: 'To', day: to },
  ];
  return (
    <Sheet
      title={DATES_TEXTS.title}
      onClose={onClose}
      actions={
        <View style={styles.pair}>
          <View style={styles.half}>
            <TextButton title="Cancel" outlined wide onPress={onClose} />
          </View>
          <View style={styles.half}>
            <TextButton title="Show" outlined strong wide onPress={onShow} />
          </View>
        </View>
      }
    >
      <Text style={styles.muted}>{DATES_TEXTS.online}</Text>
      <View style={styles.ends}>
        {ends.map(({ end, label, day }) => (
          <View key={end} style={styles.end}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${formatDay(day, today)}. Change`}
              onPress={() => onChange(end)}
              style={({ pressed }) => [styles.box, pressed && styles.pressed]}
            >
              <Calendar size={18} strokeWidth={2.25} color={colors.accent} />
              <Text style={styles.day} numberOfLines={1}>
                {formatDay(day, today)}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.small}>{DATES_TEXTS.rule}</Text>
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  muted: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  ends: { flexDirection: 'row', gap: 10, marginTop: 14 },
  end: { flex: 1, gap: 6 },
  label: { ...TYPE.label, fontSize: 13, lineHeight: 16, letterSpacing: 1.5, color: c.inkMuted },
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  pressed: { opacity: 0.6 },
  day: { flexShrink: 1, fontSize: 15, color: c.ink },
  small: { marginTop: 8, fontSize: 13, lineHeight: 18, color: c.inkMuted },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
}));
