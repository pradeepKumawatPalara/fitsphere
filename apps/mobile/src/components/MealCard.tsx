import type { MealItem, MealTag, MealTotals } from '@fitsphere/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SyncState } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';

type Props = {
  /** What the ••• button is called for screen readers, e.g. "Lunch: Wheat flour, atta". */
  title: string;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  onMenu(): void;
  onPress?(): void;
};

// One logged or saved meal (REQ-NUT-003, REQ-NUT-004, REQ-SAVED-001): its foods, kcal and protein,
// a small label per tag (Q-031), and the ••• menu.
export function MealCard({ title, items, tags, totals, syncState, onMenu, onPress }: Props) {
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? title : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={styles.body}
      >
        <Text style={styles.items}>{describeItems(items)}</Text>
        <Text style={styles.values}>
          {formatKcal(totals.kcal)} · {formatGrams(totals.proteinG)} protein
        </Text>
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                {MEAL_TAG_LABELS[tag]}
              </Text>
            ))}
          </View>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`More for ${title}`} onPress={onMenu} style={styles.menu}>
        <Text style={styles.menuText}>•••</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 10, backgroundColor: '#fff', gap: 8 },
  body: { flex: 1, gap: 4 },
  items: { fontWeight: '600' },
  values: { color: '#333' },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#e3ecf8', color: '#0d47a1' },
  note: { color: '#8a5a00', fontSize: 12 },
  menu: { paddingHorizontal: 8, paddingVertical: 4 },
  menuText: { fontSize: 18, color: '#555' },
});
