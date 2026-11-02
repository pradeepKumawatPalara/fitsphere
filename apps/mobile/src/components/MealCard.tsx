import Ionicons from '@expo/vector-icons/Ionicons';
import type { MealItem, MealPhoto, MealTag, MealTotals } from '@fitsphere/shared';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import type { SyncState } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { MealPhotoPreview } from './MealPhotoPreview';
import { Text } from './ui';

type Props = {
  /** What the card's actions are named after for screen readers, e.g. "Lunch: Wheat flour, atta". */
  title: string;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  /** A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010); saved meals have none. */
  photo?: { mealId: string; photo: MealPhoto } | null;
  /** A logged meal: opens it in Log meal. */
  onEdit?(): void;
  /** A logged meal: "Save to my meals". */
  onSave?(): void;
  /** Asks first ("Delete this meal?"), then deletes. */
  onDelete(): void;
  onPress?(): void;
};

// One logged or saved meal (REQ-NUT-003, REQ-NUT-004, REQ-SAVED-001): its foods, kcal and protein,
// a small label per tag (Q-031), its photo or image link, and its actions as icons along the foot of
// the card: Edit, Save to my meals and Delete for a logged meal, Delete for a saved one. Each icon is
// 44 to tap and named for screen readers; Delete is red.
export function MealCard({ title, items, tags, totals, syncState, photo, onEdit, onSave, onDelete, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
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
      </View>
      <View style={styles.actions}>
        {onEdit ? <IconAction icon="create-outline" label={`Edit ${title}`} color={colors.primary} onPress={onEdit} /> : null}
        {onSave ? <IconAction icon="bookmark-outline" label={`Save ${title} to my meals`} color={colors.primary} onPress={onSave} /> : null}
        <IconAction icon="trash-outline" label={`Delete ${title}`} color={colors.over} onPress={onDelete} />
      </View>
    </View>
  );
}

function IconAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress(): void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

// A tile (radius 12) with a hairline edge, so it stands out in a slot's panel and on the Saved tab
// alike; kcal and protein in fixed-width digits; the icons along the foot, right-aligned, each 44.
const useStyles = themedStyles((c) => ({
  card: {
    paddingTop: 12,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 10 },
  body: { flex: 1, gap: 6 },
  pressed: { opacity: 0.6 },
  items: { fontSize: 15, fontWeight: '600' },
  values: { fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12, backgroundColor: c.surfaceSelected, color: c.primaryStrong },
  note: { color: c.warning, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
