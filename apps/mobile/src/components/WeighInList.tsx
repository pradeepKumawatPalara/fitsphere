import { formatWeight } from '@fitsphere/shared';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { BODY_WEIGHT_UNIT, formatDay } from '../format';

export type HistoryRow = { day: string; weightGrams: number; note?: string };

// The weight history list (REQ-PRG-001). A FlatList renders only the rows on screen, which keeps
// scrolling smooth on low-end phones (ADR-0001 step 6).
export function WeighInList({ rows, footer }: { rows: HistoryRow[]; footer?: ReactElement }) {
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.day}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text>{formatDay(item.day)}</Text>
          <Text style={styles.value}>
            {formatWeight(item.weightGrams, BODY_WEIGHT_UNIT)}
            {item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
      )}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={styles.empty}>No weights in this period.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  value: { fontWeight: '600' },
  empty: { padding: 16, color: '#555' },
});
