import type { BodyWeightUnit } from '@fitsphere/shared';
import { StyleSheet, Text } from 'react-native';
import { formatDay } from '../format';
import { useTheme } from '../theme';
import { fourWeekWeight, type WeighInPoint } from './calculations';
import { Card } from './Card';
import { PROGRESS_TEXTS, weeklyRateText, weightChangeText, weightText } from './texts';

// "Weight over 4 weeks" (REQ-PRG-001): the latest weigh-in, the change and the weekly rate (Q-043,
// D-P1), or the not-enough-data message with less than a week of weigh-ins.
export function WeightCard({ weighIns, unit }: { weighIns: readonly WeighInPoint[]; unit: BodyWeightUnit }) {
  const { colors } = useTheme();
  const result = fourWeekWeight(weighIns);
  const text = { color: colors.text };

  if (!result) {
    return (
      <Card title="Weight over 4 weeks">
        <Text style={text}>{PROGRESS_TEXTS.noWeighIns}</Text>
      </Card>
    );
  }
  return (
    <Card title="Weight over 4 weeks">
      <Text style={[styles.latest, text]}>{weightText(result.latest.weightGrams, unit)}</Text>
      <Text style={{ color: colors.textMuted }}>Latest weigh-in · {formatDay(result.latest.day)}</Text>
      {result.changeGrams !== null && result.earlier ? (
        <Text style={text}>{weightChangeText(result.changeGrams, result.earlier.day, unit)}</Text>
      ) : null}
      <Text style={text}>
        {result.weeklyRateGrams === null ? PROGRESS_TEXTS.notEnoughForRate : weeklyRateText(result.weeklyRateGrams, unit)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  latest: { fontSize: 24, fontWeight: '600' },
});
