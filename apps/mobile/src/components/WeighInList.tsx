import { formatWeight } from '@fitsphere/shared';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { formatDay } from '../format';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { themedStyles } from '../theme';
import { Text } from './ui';

export type HistoryRow = { day: string; weightGrams: number; note?: string };

// The weight history list (REQ-PRG-001), in the body-weight unit setting (REQ-ACC-003). A FlatList
// renders only the rows on screen, which keeps scrolling smooth on low-end phones (ADR-0001 step 6).
export function WeighInList({ rows, footer }: { rows: HistoryRow[]; footer?: ReactElement }) {
  const styles = useStyles();
  const unit = useBodyWeightUnit();
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.day}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.day}>{formatDay(item.day)}</Text>
          <Text style={styles.value}>
            {formatWeight(item.weightGrams, unit)}
            {item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
      )}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={styles.empty}>No weights in this period.</Text>}
    />
  );
}

// Rows ruled with hairlines, as Home's measurements; weights in fixed-width digits.
const useStyles = themedStyles((c) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  day: { fontSize: 15 },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { padding: 16, fontSize: 15, color: c.inkMuted },
}));
