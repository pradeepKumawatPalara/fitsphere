import { fromGrams, type BodyWeightUnit } from '@fitsphere/shared';
import { CalendarDays, Minus, Scale, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
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
      <Hero>
        <View style={styles.empty}>
          <View style={styles.tile}>
            <Scale size={24} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>{PROGRESS_TEXTS.noWeighIns}</Text>
        </View>
      </Hero>
    );
  }
  // The latest weight is the one large reading on Progress. The change is in the text colour, not
  // green or red: losing weight is not every user's goal.
  const changeIcon = result.changeGrams === null ? Minus : result.changeGrams < 0 ? TrendingDown : result.changeGrams > 0 ? TrendingUp : Minus;
  return (
    <Hero>
      <View style={styles.reading}>
        {/* One text, so it reads as "78.8 kg"; the unit is set smaller, in caramel. */}
        <Text style={styles.latest}>
          {fromGrams(result.latest.weightGrams, unit).toFixed(1)}
          <Text style={styles.unit}> {unit}</Text>
        </Text>
        <Text style={styles.caption}>Latest weigh-in · {formatDay(result.latest.day)}</Text>
      </View>
      <View style={styles.lines}>
        {result.changeGrams !== null && result.earlier ? (
          <Line icon={changeIcon} text={weightChangeText(result.changeGrams, result.earlier.day, unit)} ruled />
        ) : null}
        <Line
          icon={CalendarDays}
          text={result.weeklyRateGrams === null ? PROGRESS_TEXTS.notEnoughForRate : weeklyRateText(result.weeklyRateGrams, unit)}
        />
      </View>
    </Hero>
  );
}

function Line({ icon: Icon, text, ruled = false }: { icon: LucideIcon; text: string; ruled?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.line, ruled && styles.ruled]}>
      <Icon size={20} color={colors.accent} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

/** The screen's hero panel, as Home's food panel: more room inside than the cards under it. */
function Hero({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.hero}>
      <Text accessibilityRole="header" style={styles.title}>
        Weight over 4 weeks
      </Text>
      {children}
    </View>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the latest weight in the hero figures Home's
// food panel uses (2.3), the change and the rate on ruled lines with their icons.
const useStyles = themedStyles((c) => ({
  hero: { padding: 20, borderRadius: 4, gap: 4, backgroundColor: c.surface },
  title: { ...TYPE.label, color: c.inkMuted },
  reading: { gap: 4 },
  latest: { ...TYPE.heroNumber, color: c.ink },
  unit: { ...TYPE.button, fontSize: 18, fontStyle: 'normal', letterSpacing: 1, color: c.accent },
  caption: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  lines: { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  line: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  ruled: { borderBottomWidth: 1, borderBottomColor: c.border },
  lineText: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: c.ink },
  empty: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  emptyText: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: c.ink },
}));
