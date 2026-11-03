import type { BodyWeightUnit } from '@fitsphere/shared';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import type { WeighInPoint } from './calculations';
import { chartGeometry } from './chartGeometry';
import { weightText } from './texts';

const HEIGHT = 160;
/** The latest dot's radius, and room kept clear for it with its edge. */
const LATEST = 5;
const DOT = 3.5;
const EDGE = 2;

type Props = {
  /** Oldest first; at least 2. */
  points: readonly WeighInPoint[];
  unit: BodyWeightUnit;
  /** Each point is a week's average (6M and All). */
  weekly: boolean;
};

// The weight trend line (REQ-PRG-004): the highest and lowest weights on the left, the first and
// last dates below. A screen reader hears a summary of the range.
export function WeightChart({ points, unit, weekly }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const geometry = chartGeometry(points, width, HEIGHT, LATEST + EDGE);
  const what = weekly ? `${points.length} weekly averages` : `${points.length} weigh-ins`;
  const line = geometry.dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const firstDot = geometry.dots[0]!;
  const lastDot = geometry.dots[geometry.dots.length - 1]!;

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
          <Text style={styles.scaleText}>{weightText(geometry.highest, unit)}</Text>
          <Text style={styles.scaleText}>{weightText(geometry.lowest, unit)}</Text>
        </View>
        <View style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={HEIGHT}>
              <Line x1={0} y1={0.5} x2={width} y2={0.5} stroke={colors.track} strokeWidth={1} />
              <Line x1={0} y1={HEIGHT / 2} x2={width} y2={HEIGHT / 2} stroke={colors.track} strokeWidth={1} strokeDasharray="3 4" />
              <Line x1={0} y1={HEIGHT - 0.5} x2={width} y2={HEIGHT - 0.5} stroke={colors.track} strokeWidth={1} />
              <Polygon points={`${line} ${lastDot.x},${HEIGHT} ${firstDot.x},${HEIGHT}`} fill={colors.accentTint} />
              <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {/* A dot for each weigh-in; a week's average is a point on the line only. */}
              {weekly
                ? null
                : geometry.dots.map((dot, index) => {
                    const latest = index === geometry.dots.length - 1;
                    return (
                      <Circle
                        key={index}
                        cx={dot.x}
                        cy={dot.y}
                        r={latest ? LATEST : DOT}
                        fill={latest ? colors.accent : colors.primary}
                        stroke={colors.surface}
                        strokeWidth={EDGE}
                      />
                    );
                  })}
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={styles.dates}>
        <Text style={styles.date}>{formatDay(first.day)}</Text>
        <Text style={styles.date}>{formatDay(last.day)}</Text>
      </View>
      {weekly ? <Text style={styles.note}>Weekly averages</Text> : null}
    </View>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the line in caramel over a tint, the latest
// dot brighter; the scale and dates in condensed figures.
const useStyles = themedStyles((c) => ({
  chart: { gap: 6 },
  body: { flexDirection: 'row', gap: 8, height: HEIGHT },
  scale: { justifyContent: 'space-between' },
  scaleText: { ...TYPE.label, fontSize: 13, letterSpacing: 0, textTransform: 'none', fontVariant: ['tabular-nums'], color: c.inkMuted },
  plot: { flex: 1 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { ...TYPE.label, fontSize: 13, letterSpacing: 0.5, color: c.inkMuted },
  note: { fontSize: 13, color: c.inkMuted },
}));
