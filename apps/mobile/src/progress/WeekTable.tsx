import type { BodyWeightUnit, IstDay, TargetKind } from '@fitsphere/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { WeekRow } from './calculations';
import { Card } from './Card';
import { weekLabel, weightCell, wholeCell } from './texts';

type Props = {
  rows: readonly WeekRow[];
  targets: Partial<Record<TargetKind, number>>;
  unit: BodyWeightUnit;
  /** This week's Monday. */
  thisWeek: IstDay;
};

type Cells = { weight: string; kcal: string; protein: string; steps: string };

// The week-by-week table (REQ-PRG-005): a Target row with the user's own targets (D-20), then each
// week's averages over the days with entries (Q-043). No "Pre" row or week details (B-02).
export function WeekTable({ rows, targets, unit, thisWeek }: Props) {
  const { colors } = useTheme();
  const target: Cells = {
    weight: weightCell(targets.body_weight ?? null, unit),
    kcal: wholeCell(targets.calories ?? null),
    protein: wholeCell(targets.protein ?? null),
    steps: wholeCell(targets.steps ?? null),
  };
  return (
    <Card title="Week by week">
      <View style={[styles.row, { borderColor: colors.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {['Week', `Weight (${unit})`, 'kcal', 'Protein (g)', 'Steps'].map((heading, index) => (
          <Text key={heading} style={[index === 0 ? styles.label : styles.value, styles.heading, { color: colors.textMuted }]}>
            {heading}
          </Text>
        ))}
      </View>
      <Row label="Target" cells={target} unit={unit} highlight />
      {rows.map((row) => (
        <Row
          key={row.weekStart}
          label={weekLabel(row.weekStart, thisWeek)}
          cells={{
            weight: weightCell(row.weightGrams, unit),
            kcal: wholeCell(row.kcal),
            protein: wholeCell(row.proteinG),
            steps: wholeCell(row.steps),
          }}
          unit={unit}
        />
      ))}
      <Text style={[styles.small, { color: colors.textFaint }]}>Averages over the days with entries.</Text>
    </Card>
  );
}

function Row({ label, cells, unit, highlight = false }: { label: string; cells: Cells; unit: BodyWeightUnit; highlight?: boolean }) {
  const { colors } = useTheme();
  const textStyle = [styles.value, { color: colors.text }, highlight ? styles.strong : null];
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${rowDescription(cells, unit)}`}
      style={[styles.row, { borderColor: colors.border }, highlight ? { backgroundColor: colors.surfaceSelected } : null]}
    >
      <Text style={[styles.label, { color: colors.text }, highlight ? styles.strong : null]}>{label}</Text>
      <Text style={textStyle}>{cells.weight}</Text>
      <Text style={textStyle}>{cells.kcal}</Text>
      <Text style={textStyle}>{cells.protein}</Text>
      <Text style={textStyle}>{cells.steps}</Text>
    </View>
  );
}

/** What a screen reader says for a row, e.g. "weight 80.3 kg, 2,000 kcal, 95 g protein, no steps". */
function rowDescription(cells: Cells, unit: BodyWeightUnit): string {
  const none = (value: string) => value === '–';
  return [
    none(cells.weight) ? 'no weight' : `weight ${cells.weight} ${unit}`,
    none(cells.kcal) ? 'no calories' : `${cells.kcal} kcal`,
    none(cells.protein) ? 'no protein' : `${cells.protein} g protein`,
    none(cells.steps) ? 'no steps' : `${cells.steps} steps`,
  ].join(', ');
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  label: { flex: 1.2, fontSize: 13 },
  value: { flex: 1, fontSize: 13, textAlign: 'right' },
  heading: { fontSize: 12 },
  strong: { fontWeight: '600' },
  small: { fontSize: 12 },
});
