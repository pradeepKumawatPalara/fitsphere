import type { MealTotals } from '@fitsphere/shared';
import { View } from 'react-native';
import { formatInteger } from '../format';
import { formatGrams, formatKcal } from '../meals';
import { themedStyles, useTheme, type ThemeColors } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// The Eaten summary (REQ-NUT-002): total kcal and colour-coded protein, carbs, fat and fibre for the
// selected date. A dash shows where there is no data: every value when nothing is logged, and a
// nutrient no logged food has a value for (MVP default, D-26). The redesign's 3.1 (locked by the
// owner, 2026-11-03): the kcal is Nutrition's hero number; each nutrient's colour is a square beside
// its name, which stays in the muted ink, as some of the colours are under 4.5:1 for text.
const NUTRIENTS = [
  { key: 'proteinG', label: 'Protein', colour: 'protein' },
  { key: 'carbsG', label: 'Carbs', colour: 'carbs' },
  { key: 'fatG', label: 'Fat', colour: 'fat' },
  { key: 'fibreG', label: 'Fibre', colour: 'fiber' },
] as const satisfies readonly { key: string; label: string; colour: keyof ThemeColors }[];

export function EatenSummary({ totals }: { totals: MealTotals | null }) {
  const styles = useStyles();
  const kcal = totals ? formatKcal(totals.kcal) : '–';
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Eaten</Text>
      <View accessible accessibilityLabel={`Eaten: ${kcal}`} style={styles.hero}>
        <Text style={[styles.kcal, !totals && styles.none]}>{totals ? formatInteger(Math.round(totals.kcal)) : '–'}</Text>
        {totals ? <Text style={styles.unit}>kcal</Text> : null}
      </View>
      <NutrientRow values={totals} />
    </View>
  );
}

/**
 * Protein, carbs, fat and fibre side by side under a hairline, each with its colour's square: the
 * Eaten card's, and what a food's amount adds (the owner, 2026-11-04). A dash where there is no value.
 */
export function NutrientRow({ values }: { values: Pick<MealTotals, 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'> | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {NUTRIENTS.map(({ key, label, colour }, index) => {
        const value = values ? formatGrams(values[key]) : '–';
        return (
          <View key={key} accessible accessibilityLabel={`${label}: ${value}`} style={[styles.nutrient, index > 0 && styles.divided]}>
            <View style={styles.labelRow}>
              <View style={[styles.swatch, { backgroundColor: colors[colour] }]} />
              <Text style={styles.label}>{label}</Text>
            </View>
            <Text style={styles.value}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

// The screen's hero panel, as Home's food panel: radius 16, the day's kcal as a 30 reading, the four
// nutrients under a hairline, in fixed-width digits.
const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 4, backgroundColor: c.surface },
  title: { ...TYPE.label, color: c.inkMuted },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 2 },
  kcal: TYPE.heroNumber,
  none: { color: c.inkSubtle },
  unit: { ...TYPE.metric, fontSize: 18, paddingBottom: 16, color: c.accent },
  row: { flexDirection: 'row', marginTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  nutrient: { flex: 1, gap: 4, paddingTop: 12, paddingLeft: 10 },
  divided: { borderLeftWidth: 1, borderLeftColor: c.border },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  label: { ...TYPE.label, letterSpacing: 1.2, color: c.inkMuted },
  value: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
}));
