import type { MealTotals } from '@fitsphere/shared';
import { StyleSheet, Text, View } from 'react-native';
import { formatGrams, formatKcal } from '../meals';

// The Eaten summary (REQ-NUT-002): total kcal and colour-coded protein, carbs, fat and fibre for the
// selected date. A dash shows where there is no data: every value when nothing is logged, and a
// nutrient no logged food has a value for (MVP default, D-26).
const NUTRIENTS = [
  { key: 'proteinG', label: 'Protein', colour: '#1565c0' },
  { key: 'carbsG', label: 'Carbs', colour: '#ef6c00' },
  { key: 'fatG', label: 'Fat', colour: '#ad1457' },
  { key: 'fibreG', label: 'Fibre', colour: '#2e7d32' },
] as const;

export function EatenSummary({ totals }: { totals: MealTotals | null }) {
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
              <Text style={[styles.label, { color: colour }]}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 8 },
  title: { color: '#555' },
  kcal: { fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  nutrient: { alignItems: 'center', gap: 2 },
  label: { fontWeight: '600', fontSize: 13 },
  value: { fontSize: 15 },
});
