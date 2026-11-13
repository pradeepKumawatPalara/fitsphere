import type { MealTotals, TargetKind } from '@fitsphere/shared';
import { View } from 'react-native';
import { formatInteger } from '../format';
import { INSIGHT_NUTRIENTS } from '../insight';
import { formatGrams } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

type Props = {
  /** The selected date's food, or null when nothing is logged that day. */
  totals: MealTotals | null;
  /** The targets that date had (D-77). */
  targets: Partial<Record<TargetKind, number>>;
};

/** "Protein: 86.0 g of 120 g", "Fat: 64.0 g of 60 g, 4.0 g over", "Fibre: none, no daily target". */
export function nutrientLabel(label: string, amount: number | null, target: number | null): string {
  const eaten = amount === null ? 'none' : formatGrams(amount);
  if (target === null) return `${label}: ${eaten}, no daily target`;
  const over = (amount ?? 0) > target ? `, ${formatGrams((amount ?? 0) - target)} over` : '';
  return `${label}: ${eaten} of ${formatInteger(target)} g${over}`;
}

// Home's nutrients, under Calories (D-103, canvas "2.3 Home · every nutrient under Calories…", B locked
// 2026-11-13; it replaced the protein card of REQ-HOME-004): protein, carbs, fat and fibre side by side, as
// Nutrition's Eaten card (REQ-NUT-002), each with its colour square, its amount ("–" when none), and under
// it "of 120 g" and a thin bar in its colour against the date's daily target (D-70, D-77); over the
// target, the line and the bar in the warning gold (Q-022). A nutrient with no target says so.
export function NutrientTargets({ totals, targets }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {INSIGHT_NUTRIENTS.map((nutrient, index) => {
        const amount = totals ? totals[nutrient.key] : null;
        const target = targets[nutrient.target] ?? null;
        const eaten = amount ?? 0;
        const over = target !== null && eaten > target;
        // A target of 0 (D-100): anything eaten fills the bar.
        const percent = target === null ? 0 : target > 0 ? Math.min(100, (eaten / target) * 100) : eaten > 0 ? 100 : 0;
        return (
          <View
            key={nutrient.key}
            testID={`nutrient-${nutrient.target}`}
            accessible
            accessibilityLabel={nutrientLabel(nutrient.label, amount, target)}
            style={[styles.nutrient, index > 0 && styles.divided]}
          >
            <View style={styles.labelRow}>
              <View style={[styles.swatch, { backgroundColor: colors[nutrient.colour] }]} />
              <Text style={styles.label}>{nutrient.label}</Text>
            </View>
            <Text style={[styles.value, amount === null && styles.none]}>{formatGrams(amount)}</Text>
            {target === null ? (
              <Text style={styles.note}>No target</Text>
            ) : (
              <>
                <Text style={[styles.note, over && styles.over]}>of {formatInteger(target)} g</Text>
                <View style={styles.bar}>
                  <View
                    testID={`bar-${nutrient.target}`}
                    style={[styles.fill, { width: `${percent}%`, backgroundColor: over ? colors.warning : colors[nutrient.colour] }]}
                  />
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

// As the Eaten card's row: the names in the muted ink beside their colour square, the amounts 20 in fixed-
// width digits; the first column flush with the card, the others after a hairline. The bar 4 tall.
const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row' },
  nutrient: { flex: 1, gap: 4, paddingRight: 6 },
  divided: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: c.border },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  label: { ...TYPE.label, letterSpacing: 1.2, color: c.inkMuted },
  value: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
  none: { color: c.inkSubtle },
  note: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  over: { color: c.warning },
  bar: { height: 4, marginTop: 2, borderRadius: 2, overflow: 'hidden', backgroundColor: c.track },
  fill: { height: 4 },
}));
