import type { BodyWeightUnit } from '@fitsphere/shared';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { useTheme } from '../theme';
import { fourWeekWeight, type WeighInPoint } from './calculations';
import { PROGRESS_TEXTS, weeklyRateText, weightChangeText, weightText } from './texts';

// "Weight over 4 weeks" (REQ-PRG-001): the latest weigh-in, the change and the weekly rate (Q-043,
// D-30), or the not-enough-data message with less than a week of weigh-ins.
export function WeightCard({ weighIns, unit }: { weighIns: readonly WeighInPoint[]; unit: BodyWeightUnit }) {
  const { colors } = useTheme();
  const result = fourWeekWeight(weighIns);
  const text = { color: colors.ink };

  if (!result) {
    return (
      <Hero>
        <Text style={[styles.body, text]}>{PROGRESS_TEXTS.noWeighIns}</Text>
      </Hero>
    );
  }
  // The latest weight is the one large reading on Progress. The change is in the text colour, not
  // green or red: losing weight is not every user's goal.
  return (
    <Hero>
      <View style={styles.reading}>
        <Text style={[styles.latest, text]}>{weightText(result.latest.weightGrams, unit)}</Text>
        <Text style={[styles.caption, { color: colors.inkMuted }]}>Latest weigh-in · {formatDay(result.latest.day)}</Text>
      </View>
      <View style={styles.lines}>
        {result.changeGrams !== null && result.earlier ? (
          <Text style={[styles.body, text]}>{weightChangeText(result.changeGrams, result.earlier.day, unit)}</Text>
        ) : null}
        <Text style={[styles.body, text]}>
          {result.weeklyRateGrams === null ? PROGRESS_TEXTS.notEnoughForRate : weeklyRateText(result.weeklyRateGrams, unit)}
        </Text>
      </View>
    </Hero>
  );
}

/** The screen's hero panel, as Home's food panel: radius 16, more room inside than the cards under it. */
function Hero({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
        Weight over 4 weeks
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 20, borderRadius: 16, gap: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  reading: { gap: 2 },
  latest: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13 },
  lines: { gap: 4 },
  body: { fontSize: 15 },
});
