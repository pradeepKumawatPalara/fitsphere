import type { IstDay } from '@fitsphere/shared';
import { StyleSheet } from 'react-native';
import { Text, TextButton } from '../components/ui';
import { formatInteger } from '../format';
import { useTheme } from '../theme';
import { averageCalories, daysLogged, type DayNutrition } from './calculations';
import { Card } from './Card';
import { averageCaloriesText, daysLoggedText, PROGRESS_TEXTS } from './texts';

type Props = {
  nutrition: Readonly<Record<IstDay, DayNutrition>>;
  today: IstDay;
  accountStart: IstDay | null;
  /** The user's own daily calorie target (D-20), or null when none is set. */
  calorieTarget: number | null;
  onSetTarget(): void;
};

// The last 4 weeks of eating: average daily calories against the user's own target (REQ-PRG-002)
// and "Meals logged: X of Y days" (REQ-PRG-003, Q-044).
export function NutritionCard({ nutrition, today, accountStart, calorieTarget, onSetTarget }: Props) {
  const { colors } = useTheme();
  const average = averageCalories(nutrition, today);
  const text = { color: colors.ink };
  return (
    <Card title="Average calories, last 4 weeks">
      {average === null ? (
        <Text style={[styles.body, text]}>{PROGRESS_TEXTS.noMeals}</Text>
      ) : (
        <Text style={[styles.average, text]}>{averageCaloriesText(average)}</Text>
      )}
      {calorieTarget === null ? (
        <>
          <Text style={[styles.small, { color: colors.inkMuted }]}>{PROGRESS_TEXTS.noCalorieTarget}</Text>
          <TextButton title="Set a target" outlined onPress={onSetTarget} />
        </>
      ) : (
        <Text style={[styles.small, { color: colors.inkMuted }]}>Target {formatInteger(calorieTarget)} kcal a day</Text>
      )}
      <Text style={[styles.body, text]}>{daysLoggedText(daysLogged(nutrition, today, accountStart))}</Text>
    </Card>
  );
}

// A value, not the screen's reading: the latest weight is the one large number on Progress.
const styles = StyleSheet.create({
  average: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
});
