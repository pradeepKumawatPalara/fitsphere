import type { IstDay } from '@fitsphere/shared';
import { View } from 'react-native';
import { Text, TextButton } from '../components/ui';
import { formatInteger } from '../format';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { averageCalories, daysLogged, type DayNutrition } from './calculations';
import { Card } from './Card';
import { daysLoggedText, PROGRESS_TEXTS } from './texts';

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
  const styles = useStyles();
  const average = averageCalories(nutrition, today);
  const logged = daysLogged(nutrition, today, accountStart);
  return (
    <Card title="Average calories, last 4 weeks">
      <View style={styles.values}>
        {average === null ? (
          <Text style={styles.body}>{PROGRESS_TEXTS.noMeals}</Text>
        ) : (
          // One text, so it reads as "1,850 kcal a day"; the unit is set smaller, in caramel.
          <Text style={styles.average}>
            {formatInteger(average)}
            <Text style={styles.unit}> kcal a day</Text>
          </Text>
        )}
        {calorieTarget === null ? (
          <>
            <Text style={styles.small}>{PROGRESS_TEXTS.noCalorieTarget}</Text>
            <TextButton title="Set a target" outlined onPress={onSetTarget} />
          </>
        ) : (
          <Text style={styles.small}>Target {formatInteger(calorieTarget)} kcal a day</Text>
        )}
      </View>
      <View style={styles.logged}>
        <Text style={styles.body}>{daysLoggedText(logged)}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${logged.total === 0 ? 0 : Math.round((logged.logged / logged.total) * 100)}%` }]} />
        </View>
      </View>
    </Card>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03): the average in condensed figures, its unit in
// caramel; the days logged over a thin bar in the "logged" green, as the week strip's marks.
const useStyles = themedStyles((c) => ({
  values: { gap: 6 },
  average: { ...TYPE.metric, fontSize: 40, lineHeight: 44, color: c.ink },
  unit: { ...TYPE.link, fontSize: 16, color: c.accent },
  body: { fontSize: 15, lineHeight: 22, color: c.ink },
  small: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  logged: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: c.track },
  fill: { height: 6, backgroundColor: c.success },
}));
