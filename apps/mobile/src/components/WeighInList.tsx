import { formatWeight } from '@fitsphere/shared';
import type { ReactElement } from 'react';
import { FlatList, View } from 'react-native';
import { formatDay } from '../format';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

export type HistoryRow = { day: string; weightGrams: number; note?: string };

// The weight history list (REQ-PRG-001), in the body-weight unit setting (REQ-ACC-003). A FlatList
// renders only the rows on screen, which keeps scrolling smooth on low-end phones (ADR-0001 step 6).
export function WeighInList({ rows, footer }: { rows: HistoryRow[]; footer?: ReactElement }) {
  const styles = useStyles();
  const unit = useBodyWeightUnit();
  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={(row) => row.day}
      style={styles.list}
      contentContainerStyle={styles.content}
      renderItem={({ item, index }) => {
        const weight = formatWeight(item.weightGrams, unit);
        return (
          // Together the rows make one card: the first rounds its top, the last its foot.
          <View
            accessible
            accessibilityLabel={`${formatDay(item.day)}: ${weight}${item.note ? ` · ${item.note}` : ''}`}
            style={[styles.row, index === 0 ? styles.first : styles.ruled, index === rows.length - 1 && styles.last]}
          >
            <View style={styles.dayColumn}>
              <Text style={styles.day}>{formatDay(item.day)}</Text>
              {item.note ? (
                <View style={styles.noteLine}>
                  <View style={[styles.dot, item.note === 'not saved' && styles.dotProblem]} />
                  <Text style={[styles.note, item.note === 'not saved' && styles.problem]}>{item.note}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.value}>{weight}</Text>
          </View>
        );
      }}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={styles.empty}>No weights in this period.</Text>}
    />
  );
}

// The redesign's 5.2 (locked by the owner, 2026-11-03): the weigh-ins ruled on a raised card, each
// weight in condensed figures; a waiting or refused weigh-in says so under its date.
const useStyles = themedStyles((c) => ({
  list: { backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 34 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  first: { borderTopWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  ruled: { borderTopWidth: 1 },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  dayColumn: { flexShrink: 1, gap: 2 },
  day: { fontSize: 15, lineHeight: 20 },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  note: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  problem: { color: c.danger },
  value: { ...TYPE.metric, color: c.ink },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
    fontSize: 15,
    lineHeight: 22,
    color: c.inkMuted,
    textAlign: 'center',
  },
}));
