import type { BodyWeightUnit } from '@fitsphere/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import type { WeighInPoint } from './calculations';
import { chartGeometry } from './chartGeometry';
import { weightText } from './texts';

const HEIGHT = 160;
/** Room above the line for the touched point's bubble, as on an exercise's graph (D-82, the owner's C). */
const BUBBLE_ROOM = 40;
/** The latest dot's radius, and room kept clear for it with its edge. */
const LATEST = 5;
const DOT = 3.5;
const EDGE = 2;
/** The touched point's ringed dot. */
const TOUCHED = 7;
/** More points than this, and only the line is drawn, with the latest and the touched dots: light on low-end phones. */
const MAX_DOTS = 120;

type Props = {
  /** Oldest first; at least 2. */
  points: readonly WeighInPoint[];
  unit: BodyWeightUnit;
};

// The weight trend line (REQ-PRG-004): the highest and lowest weights on the left, the first and
// last dates below; every weigh-in a point, each on its day (the owner, 2026-11-16; 6M and All plotted
// weekly averages before). Pressing it and sliding picks the nearest point (the owner, 2026-11-16: with many
// points the values could not be read; as an exercise's graph, D-82, the owner's C): its dot ringed, a
// dashed line down from a bubble at the top with its weight and date, kept after the finger lifts
// until the chart is tapped beside the line or another range is chosen. A screen reader hears a
// summary of the range, and moves from point to point by swiping up or down.
export function WeightChart({ points, unit }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [bubbleWidth, setBubbleWidth] = useState(0);
  // The point touched; the parent draws a new chart for another range (its `key`), which forgets it.
  const [touched, setTouched] = useState<number | null>(null);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const geometry = chartGeometry(points, width, HEIGHT, TOUCHED + EDGE);
  const what = `${points.length} weigh-ins`;
  const dotted = points.length <= MAX_DOTS;
  const line = geometry.dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const firstDot = geometry.dots[0]!;
  const lastDot = geometry.dots[geometry.dots.length - 1]!;
  const point = touched === null ? undefined : points[touched];
  const dot = touched === null ? undefined : geometry.dots[touched];
  const said = (index: number) => `${formatDay(points[index]!.day)}, ${weightText(points[index]!.weightGrams, unit)}`;
  const bubbleLeft = dot ? Math.min(Math.max(dot.x - bubbleWidth / 2, 0), Math.max(width - bubbleWidth, 0)) : 0;

  /** The point whose dot is nearest across. */
  function pick(x: number) {
    let nearest = 0;
    geometry.dots.forEach((each, index) => {
      if (Math.abs(each.x - x) < Math.abs(geometry.dots[nearest]!.x - x)) nearest = index;
    });
    setTouched(nearest);
  }

  return (
    <Pressable
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${what}, ${weightText(first.weightGrams, unit)} on ${formatDay(first.day)} to ${weightText(
        last.weightGrams,
        unit,
      )} on ${formatDay(last.day)}`}
      accessibilityValue={{ text: touched === null ? 'Swipe up or down to hear each point' : said(touched) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const from = touched ?? (step > 0 ? -1 : points.length);
        setTouched(Math.min(Math.max(from + step, 0), points.length - 1));
      }}
      // Tapped beside the line (the scale, the dates): the bubble goes.
      onPress={() => setTouched(null)}
      style={styles.chart}
    >
      <View style={styles.body}>
        <View style={styles.scale}>
          <Text style={styles.scaleText}>{weightText(geometry.highest, unit)}</Text>
          <Text style={styles.scaleText}>{weightText(geometry.lowest, unit)}</Text>
        </View>
        <View
          testID="weight-chart-plot"
          style={styles.plot}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => pick(event.nativeEvent.locationX)}
          onResponderMove={(event) => pick(event.nativeEvent.locationX)}
        >
          {width > 0 ? (
            <Svg width={width} height={HEIGHT} style={styles.svg}>
              <Line x1={0} y1={0.5} x2={width} y2={0.5} stroke={colors.track} strokeWidth={1} />
              <Line x1={0} y1={HEIGHT / 2} x2={width} y2={HEIGHT / 2} stroke={colors.track} strokeWidth={1} strokeDasharray="3 4" />
              <Line x1={0} y1={HEIGHT - 0.5} x2={width} y2={HEIGHT - 0.5} stroke={colors.track} strokeWidth={1} />
              <Polygon points={`${line} ${lastDot.x},${HEIGHT} ${firstDot.x},${HEIGHT}`} fill={colors.accentTint} />
              <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {dot ? <Line x1={dot.x} y1={0} x2={dot.x} y2={HEIGHT} stroke={colors.ink} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} /> : null}
              {/* A dot for each weigh-in; with very many, only the latest and the one touched. */}
              {geometry.dots.map((each, index) => {
                const isTouched = index === touched;
                const latest = index === geometry.dots.length - 1;
                if (!dotted && !isTouched && !latest) return null;
                return (
                  <Circle
                    key={index}
                    cx={each.x}
                    cy={each.y}
                    r={isTouched ? TOUCHED : latest ? LATEST : DOT}
                    fill={isTouched ? colors.bg : latest ? colors.accent : colors.primary}
                    stroke={isTouched ? colors.primary : colors.surface}
                    strokeWidth={isTouched ? 3.5 : EDGE}
                  />
                );
              })}
            </Svg>
          ) : null}
          {point && dot ? (
            <View
              testID="weight-chart-bubble"
              pointerEvents="none"
              onLayout={(event) => setBubbleWidth(event.nativeEvent.layout.width)}
              style={[styles.bubble, { left: bubbleLeft }]}
            >
              <Text style={styles.bubbleValue}>{weightText(point.weightGrams, unit)}</Text>
              <Text style={styles.bubbleDay}>{formatDay(point.day)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.dates}>
        <Text style={styles.date}>{formatDay(first.day)}</Text>
        <Text style={styles.date}>{formatDay(last.day)}</Text>
      </View>
    </Pressable>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the line in caramel over a tint, the latest
// dot brighter; the scale and dates in condensed figures. The touched point's bubble, ink on the
// background's colour, as an exercise's graph (D-82, canvas "ProgressTouch", C locked).
const useStyles = themedStyles((c) => ({
  chart: { gap: 6 },
  body: { flexDirection: 'row', gap: 8, height: HEIGHT + BUBBLE_ROOM },
  scale: { justifyContent: 'space-between', paddingTop: BUBBLE_ROOM },
  scaleText: { ...TYPE.label, fontSize: 13, letterSpacing: 0, textTransform: 'none', fontVariant: ['tabular-nums'], color: c.inkMuted },
  plot: { flex: 1 },
  svg: { marginTop: BUBBLE_ROOM },
  bubble: { position: 'absolute', top: 0, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, backgroundColor: c.ink, elevation: 3 },
  bubbleValue: { ...TYPE.metric, fontSize: 17, lineHeight: 19, color: c.bg },
  bubbleDay: { fontSize: 12, lineHeight: 15, color: c.bg },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { ...TYPE.label, fontSize: 13, letterSpacing: 0.5, color: c.inkMuted },
}));
