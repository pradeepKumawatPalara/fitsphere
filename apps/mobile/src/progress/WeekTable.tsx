import type { BodyWeightUnit, IstDay, TargetKind } from '@fitsphere/shared';
import { View } from 'react-native';
import { Text } from '../components/ui';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
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
  const styles = useStyles();
  const target: Cells = {
    weight: weightCell(targets.body_weight ?? null, unit),
    kcal: wholeCell(targets.calories ?? null),
    protein: wholeCell(targets.protein ?? null),
    steps: wholeCell(targets.steps ?? null),
  };
  return (
    <Card title="Week by week">
      <View style={[styles.row, styles.headingRow]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {['Week', `Weight (${unit})`, 'kcal', 'Protein (g)', 'Steps'].map((heading, index) => (
          <Text key={heading} style={[styles.heading, index === 0 ? styles.labelColumn : styles.valueColumn]}>
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
      <Text style={styles.small}>Averages over the days with entries.</Text>
    </Card>
  );
}

function Row({ label, cells, unit, highlight = false }: { label: string; cells: Cells; unit: BodyWeightUnit; highlight?: boolean }) {
  const styles = useStyles();
  const textStyle = [styles.value, styles.valueColumn];
  return (
    <View accessible accessibilityLabel={`${label}: ${rowDescription(cells, unit)}`} style={[styles.row, highlight ? styles.target : styles.ruled]}>
      <Text style={[styles.label, styles.labelColumn, highlight && styles.targetLabel]}>{label}</Text>
      {/* One line each: a value too wide for its column (a large font setting) shrinks, never wraps. */}
      <Text numberOfLines={1} adjustsFontSizeToFit style={textStyle}>
        {cells.weight}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={textStyle}>
        {cells.kcal}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={textStyle}>
        {cells.protein}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={textStyle}>
        {cells.steps}
      </Text>
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

// Fixed-width digits, so each column lines up; condensed, so "100,000" (the most steps that can be
// logged) fits a value column at 360dp. The redesign's 5.1 (locked by the owner, 2026-11-03): the
// headings in small muted capitals, the Target row on a caramel tint, each week ruled.
const useStyles = themedStyles((c) => ({
  row: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  headingRow: { minHeight: 0, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  ruled: { borderBottomWidth: 1, borderBottomColor: c.border },
  target: { borderRadius: 4, backgroundColor: c.accentTint },
  labelColumn: { flex: 1.3 },
  valueColumn: { flex: 1, textAlign: 'right' },
  heading: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 0.8, color: c.inkMuted },
  label: { ...TYPE.label, fontSize: 15, lineHeight: 18, letterSpacing: 0, color: c.ink },
  targetLabel: { fontFamily: TYPE.metric.fontFamily, color: c.accent },
  value: { ...TYPE.label, fontSize: 16, lineHeight: 20, letterSpacing: 0, fontVariant: ['tabular-nums'], color: c.ink },
  small: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
}));
