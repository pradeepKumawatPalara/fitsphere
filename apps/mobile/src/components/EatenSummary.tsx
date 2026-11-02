import type { MealTotals } from '@fitsphere/shared';
import { StyleSheet, View } from 'react-native';
import { formatGrams, formatKcal } from '../meals';
import { themedStyles, useTheme, type ThemeColors } from '../theme';
import { Text } from './ui';

// The Eaten summary (REQ-NUT-002): total kcal and colour-coded protein, carbs, fat and fibre for the
// selected date. A dash shows where there is no data: every value when nothing is logged, and a
// nutrient no logged food has a value for (MVP default, D-26).
const NUTRIENTS = [
  { key: 'proteinG', label: 'Protein', colour: 'primary' },
  { key: 'carbsG', label: 'Carbs', colour: 'macroCarbs' },
  { key: 'fatG', label: 'Fat', colour: 'macroFat' },
  { key: 'fibreG', label: 'Fibre', colour: 'macroFibre' },
] as const satisfies readonly { key: string; label: string; colour: keyof ThemeColors }[];

export function EatenSummary({ totals }: { totals: MealTotals | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const kcal = totals ? formatKcal(totals.kcal) : '–';
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Eaten</Text>
      <Text accessibilityLabel={`Eaten: ${kcal}`} style={styles.kcal}>
        {kcal}
      </Text>
      <View style={styles.row}>
        {NUTRIENTS.map(({ key, label, colour }) => {
          const value = totals ? formatGrams(totals[key]) : '–';
          return (
            <View key={key} accessible accessibilityLabel={`${label}: ${value}`} style={styles.nutrient}>
              <Text style={[styles.label, { color: colors[colour] }]}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// The screen's hero panel, as Home's food panel: radius 16, the day's kcal as a 30 reading, the four
// nutrients under a hairline, in fixed-width digits.
const useStyles = themedStyles((c) => ({
  card: { padding: 20, borderRadius: 16, backgroundColor: c.surface, gap: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  kcal: { marginTop: -8, fontSize: 30, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  nutrient: { alignItems: 'center', gap: 2 },
  label: { fontWeight: '600', fontSize: 13 },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
}));
