import { fromGrams, type BodyWeightUnit } from '@fitsphere/shared';
import { CalendarDays, CircleGauge, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { fourWeekWeight, type WeighInPoint } from './calculations';
import { PROGRESS_TEXTS, weeklyRateText, weightChangeText } from './texts';

// "Weight over 4 weeks" (REQ-PRG-001): the latest weigh-in, the change and the weekly rate (Q-043,
// D-30), or the not-enough-data message with less than a week of weigh-ins.
export function WeightCard({ weighIns, unit }: { weighIns: readonly WeighInPoint[]; unit: BodyWeightUnit }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const result = fourWeekWeight(weighIns);

  if (!result) {
    return (
      <Hero unit={unit}>
        <View style={styles.empty}>
          <View style={styles.tile}>
            <CircleGauge size={24} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>{PROGRESS_TEXTS.noWeighIns}</Text>
        </View>
      </Hero>
    );
  }
  // The latest weight is the one large reading on Progress. The change is in the text colour, not
  // green or red: losing weight is not every user's goal.
  const rate = result.weeklyRateGrams;
  const changeIcon = result.changeGrams === null ? Minus : result.changeGrams < 0 ? TrendingDown : result.changeGrams > 0 ? TrendingUp : Minus;
  return (
    <Hero unit={unit}>
      {/* The weight, the change since a day and the weekly rate in one row (the owner chose option C,
          2026-11-17: the stacked rows, then option B's two rows, took too much room). */}
      <View style={styles.cols}>
        <View accessible accessibilityLabel={`Latest weigh-in · ${formatDay(result.latest.day)}: ${fromGrams(result.latest.weightGrams, unit).toFixed(1)} ${unit}`} style={[styles.cell, styles.first]}>
          <Head icon={CircleGauge} text="Weight" />
          {/* The same figure style as the change and the rate beside it. */}
          <Text numberOfLines={1} style={styles.figure}>
            {fromGrams(result.latest.weightGrams, unit).toFixed(1)}
          </Text>
          <Text style={styles.sub}>{formatDay(result.latest.day)}</Text>
        </View>
        {result.changeGrams !== null && result.earlier ? (
          <Cell
            icon={changeIcon}
            head="Since"
            figure={signed(result.changeGrams, unit)}
            note={`since ${formatDay(result.earlier.day)}`}
            label={weightChangeText(result.changeGrams, result.earlier.day, unit)}
          />
        ) : null}
        <Cell
          icon={CalendarDays}
          head="Week"
          figure={rate === null ? '–' : signed(Math.round(rate), unit)}
          note={rate === null ? 'needs a week' : 'a week'}
          label={rate === null ? PROGRESS_TEXTS.notEnoughForRate : weeklyRateText(rate, unit)}
          last
        />
      </View>
    </Hero>
  );
}

/** "−1.2", "+0.4", or "0.0" when it rounds to nothing; the unit is in the card's heading. */
function signed(grams: number, unit: BodyWeightUnit): string {
  const size = fromGrams(Math.abs(grams), unit);
  const text = size.toFixed(1);
  return size === 0 ? text : `${grams < 0 ? '−' : '+'}${text}`;
}

function Head({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.head}>
      <Icon size={13} strokeWidth={2.25} color={colors.accent} />
      <Text style={styles.headText}>{text}</Text>
    </View>
  );
}

/** One column of the row, read out as the whole sentence (`label`). */
function Cell({ icon, head, figure, note, label, last = false }: { icon: LucideIcon; head: string; figure: string; note: string; label: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={label} style={[styles.cell, styles.divided, last && styles.last]}>
      <Head icon={icon} text={head} />
      <Text numberOfLines={1} style={styles.figure}>
        {figure}
      </Text>
      <Text numberOfLines={1} style={styles.sub}>
        {note}
      </Text>
    </View>
  );
}

/** The screen's hero panel, as Home's food panel: more room inside than the cards under it. */
function Hero({ unit, children }: { unit: BodyWeightUnit; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.hero}>
      <Text accessibilityRole="header" style={styles.title}>
        Weight over 4 weeks · {unit}
      </Text>
      {children}
    </View>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the latest weight in the hero figures Home's
// food panel uses (2.3), the change and the rate on ruled lines with their icons.
const useStyles = themedStyles((c) => ({
  hero: { padding: 12, paddingHorizontal: 16, borderRadius: 4, gap: 10, backgroundColor: c.surface },
  title: { ...TYPE.label, color: c.inkMuted },
  cols: { flexDirection: 'row' },
  // Three equal columns with the same 10 either side of each line, so the heads, figures and notes line up.
  cell: { flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start', paddingHorizontal: 10 },
  first: { paddingLeft: 0 },
  divided: { borderLeftWidth: 1, borderLeftColor: c.border },
  last: { paddingRight: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headText: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1.2, color: c.inkMuted },
  figure: { ...TYPE.metric, fontSize: 26, lineHeight: 42, fontVariant: ['tabular-nums'], color: c.ink },
  sub: { fontSize: 11, lineHeight: 14, color: c.inkMuted },
  empty: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  emptyText: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: c.ink },
}));
