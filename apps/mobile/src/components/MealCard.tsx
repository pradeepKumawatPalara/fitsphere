import type { MealItem, MealPhoto, MealTag, MealTotals } from '@fitsphere/shared';
import { Pressable, View } from 'react-native';
import type { SyncState } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { themedStyles } from '../theme';
import { MealPhotoPreview } from './MealPhotoPreview';
import { Text } from './ui';

type Props = {
  /** What the ••• button is called for screen readers, e.g. "Lunch: Wheat flour, atta". */
  title: string;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  /** A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010); saved meals have none. */
  photo?: { mealId: string; photo: MealPhoto } | null;
  onMenu(): void;
  onPress?(): void;
};

// One logged or saved meal (REQ-NUT-003, REQ-NUT-004, REQ-SAVED-001): its foods, kcal and protein,
// a small label per tag (Q-031), its photo or image link, and the ••• menu.
export function MealCard({ title, items, tags, totals, syncState, photo, onMenu, onPress }: Props) {
  const styles = useStyles();
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? title : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
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
      {photo ? <MealPhotoPreview mealId={photo.mealId} photo={photo.photo} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More for ${title}`}
        onPress={onMenu}
        style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
      >
        <Text style={styles.menuText}>•••</Text>
      </Pressable>
    </View>
  );
}

// A tile (radius 12) with a hairline edge, so it stands out in a slot's panel and on the Saved tab
// alike; kcal and protein in fixed-width digits; the ••• is 44 to tap, as on Log meal.
const useStyles = themedStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    gap: 8,
  },
  body: { flex: 1, gap: 6 },
  pressed: { opacity: 0.6 },
  items: { fontSize: 15, fontWeight: '600' },
  values: { fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, backgroundColor: c.surfaceSelected, color: c.primaryStrong },
  note: { color: c.warning, fontSize: 13 },
  menu: { width: 44, height: 44, marginTop: -10, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontSize: 18, color: c.textMuted },
}));
