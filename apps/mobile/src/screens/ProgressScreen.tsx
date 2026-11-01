import { istWeekStart, type IstDay } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MeasurementsSheet } from '../components/MeasurementsSheet';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { weekRows } from '../progress/calculations';
import { MeasurementsSection } from '../progress/MeasurementsSection';
import { NutritionCard } from '../progress/NutritionCard';
import { useProgressWeightUnit } from '../progress/units';
import { useProgressData } from '../progress/useProgressData';
import { WeekTable } from '../progress/WeekTable';
import { WeightCard } from '../progress/WeightCard';
import { WeightTrend } from '../progress/WeightTrend';
import { useSync } from '../sync/SyncProvider';
import { useTheme } from '../theme';

// Progress (REQ-PRG-001…006; D-30): the user's trends from what the phone holds, in the
// body-weight unit and the theme's colours. Not tied to the header's selected date: the cards end
// today.
export function ProgressScreen() {
  const router = useRouter();
  const sync = useSync();
  const { colors } = useTheme();
  const unit = useProgressWeightUnit();
  const { today, firstDay } = useSelectedDay();
  const [sheet, setSheet] = useState<{ mode: 'add' | 'edit'; day: IstDay } | null>(null);
  // Read again when the measurements sheet closes, which may change the cm/in choice.
  const data = useProgressData(today, sheet);

  if (!data) return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  const { accountStart } = data;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <WeightCard weighIns={data.weighIns} unit={unit} />
        <WeightTrend
          weighIns={data.weighIns}
          today={today}
          accountStart={accountStart}
          unit={unit}
          onAllWeighIns={() => router.push('/weight-history')}
        />
        <NutritionCard
          nutrition={data.nutrition}
          today={today}
          accountStart={accountStart}
          calorieTarget={data.targets.calories ?? null}
          onSetTarget={() => router.push('/targets')}
        />
        <WeekTable
          rows={weekRows({ today, accountStart, weighIns: data.weighIns, nutrition: data.nutrition, steps: data.steps })}
          targets={data.targets}
          unit={unit}
          thisWeek={istWeekStart(today)}
        />
        <MeasurementsSection
          measurements={data.measurements}
          unit={data.lengthUnit}
          onAdd={() => setSheet({ mode: 'add', day: today })}
          onEdit={(day) => setSheet({ mode: 'edit', day })}
        />
      </ScrollView>
      {sheet ? (
        <MeasurementsSheet
          mode={sheet.mode}
          initialDay={sheet.day}
          today={today}
          firstDay={firstDay}
          onSave={(input) => sync.save('measurements', input)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
});
