import type { BodyWeightUnit } from '@fitsphere/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { useTheme } from '../theme';
import type { WeighInPoint } from './calculations';
import { chartGeometry } from './chartGeometry';
import { weightText } from './texts';

const HEIGHT = 160;
const DOT = 8;
const THICKNESS = 2;

type Props = {
  /** Oldest first; at least 2. */
  points: readonly WeighInPoint[];
  unit: BodyWeightUnit;
  /** Each point is a week's average (6M and All). */
  weekly: boolean;
};

// The weight trend line (REQ-PRG-004), drawn with plain views (D-30): the highest and lowest weights
// on the left, the first and last dates below. A screen reader hears a summary of the range.
export function WeightChart({ points, unit, weekly }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const geometry = chartGeometry(points, width, HEIGHT, DOT / 2, THICKNESS);
  const what = weekly ? `${points.length} weekly averages` : `${points.length} weigh-ins`;
  const muted = { color: colors.inkMuted };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${what}, ${weightText(first.weightGrams, unit)} on ${formatDay(first.day)} to ${weightText(
        last.weightGrams,
        unit,
      )} on ${formatDay(last.day)}`}
      style={styles.chart}
    >
      <View style={styles.body}>
        <View style={styles.scale}>
          <Text style={[styles.small, muted]}>{weightText(geometry.highest, unit)}</Text>
          <Text style={[styles.small, muted]}>{weightText(geometry.lowest, unit)}</Text>
        </View>
        <View
          style={[styles.plot, { borderColor: colors.track }]}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {width > 0
            ? geometry.lines.map((line, index) => (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.line,
                    {
                      left: line.left,
                      top: line.top,
                      width: line.length,
                      backgroundColor: colors.primary,
                      transform: [{ rotate: `${line.angle}rad` }],
                    },
                  ]}
                />
              ))
            : null}
          {width > 0
            ? geometry.dots.map((dot, index) => (
                <View
                  key={`dot-${index}`}
                  style={[styles.dot, { left: dot.x - DOT / 2, top: dot.y - DOT / 2, backgroundColor: colors.primary }]}
                />
              ))
            : null}
        </View>
      </View>
      <View style={styles.dates}>
        <Text style={[styles.small, muted]}>{formatDay(first.day)}</Text>
        <Text style={[styles.small, muted]}>{formatDay(last.day)}</Text>
      </View>
      {weekly ? <Text style={[styles.small, muted]}>Weekly averages</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: 4 },
  body: { flexDirection: 'row', gap: 8, height: HEIGHT },
  scale: { justifyContent: 'space-between' },
  plot: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { position: 'absolute', height: THICKNESS },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  // Fixed-width digits; the drawing itself is unchanged.
  small: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
