import type { IstDay } from '@fitsphere/shared';
import { Button, StyleSheet, Text } from 'react-native';
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
  const text = { color: colors.text };
  return (
    <Card title="Average calories, last 4 weeks">
      {average === null ? (
        <Text style={text}>{PROGRESS_TEXTS.noMeals}</Text>
      ) : (
        <Text style={[styles.average, text]}>{averageCaloriesText(average)}</Text>
      )}
      {calorieTarget === null ? (
        <>
          <Text style={{ color: colors.textMuted }}>{PROGRESS_TEXTS.noCalorieTarget}</Text>
          <Button title="Set a target" onPress={onSetTarget} />
        </>
      ) : (
        <Text style={{ color: colors.textMuted }}>Target {formatInteger(calorieTarget)} kcal a day</Text>
      )}
      <Text style={text}>{daysLoggedText(daysLogged(nutrition, today, accountStart))}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  average: { fontSize: 24, fontWeight: '600' },
});
