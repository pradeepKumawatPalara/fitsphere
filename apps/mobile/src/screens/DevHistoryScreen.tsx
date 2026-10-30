import { addDays, istToday } from '@fitsphere/shared';
import { useState } from 'react';
import { WeighInList, type HistoryRow } from '../components/WeighInList';
import { Text } from '../components/ui';

// Development builds only (ADR-0001 step 6): the history list with 200 synthetic rows, to scroll
// on the phone. Nothing is saved.
export function DevHistoryScreen() {
  const [rows] = useState<HistoryRow[]>(() => {
    const today = istToday();
    return Array.from({ length: 200 }, (_, index) => ({
      day: addDays(today, -index),
      weightGrams: 60_000 + ((index * 137) % 20_000),
    }));
  });
  if (!__DEV__) return <Text>Not available.</Text>;
  return <WeighInList rows={rows} />;
}
