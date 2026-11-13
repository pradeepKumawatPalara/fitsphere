import type { MealItem, MealPhoto, MealTag, MealTotals } from '@fitsphere/shared';
import { Bookmark, ChartPie, SquarePen, Trash } from 'lucide-react-native';
import { View } from 'react-native';
import { formatIstTime } from '../format';
import type { SyncState } from '../local/store';
import { formatAmount, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { IconAction } from './MealCard';
import { MealPhotoPreview } from './MealPhotoPreview';
import { Text } from './ui';

type Props = {
  /** The meal as its actions are named for screen readers, e.g. "Lunch: Roti + 2 more". */
  title: string;
  /** Its meal's name, "Lunch": what a food is removed from. */
  slotLabel: string;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  /** Its photo or image link (REQ-LOG-006, REQ-LOG-010). */
  photo: { mealId: string; photo: MealPhoto } | null;
  /** When it was last saved, shown as "Saved 8:15 am" in India time (D-34). */
  savedAt: string;
  /** The saved meal's name when the whole meal is saved already: its bookmark is filled. */
  savedAs: string | null;
  /** For each food, in order: the saved meal's name when that food on its own is saved already (D-97). */
  foodsSavedAs: readonly (string | null)[];
  /** Opens Insight on its meal type (D-70). */
  onInsight(): void;
  /** Opens the whole meal in Log meal. */
  onEdit(): void;
  /** "Save to my meals" for the whole meal. */
  onSave(): void;
  /** Asks first ("Delete this meal?"), then deletes the whole meal. */
  onDelete(): void;
  /** One food (D-97): its own page, or the sheet for its amount. */
  onEditFood(index: number): void;
  /** One food on its own to "Save to my meals" (D-97). */
  onSaveFood(index: number): void;
  /** One food out of the meal, after asking (D-97). */
  onRemoveFood(index: number): void;
};

// One logged meal in Nutrition › Consumed (REQ-NUT-003, REQ-NUT-004; the redesign's 3.1, D-97 locked by
// the owner 2026-11-13, option A): its kcal and protein and when it was saved, its tags (Q-031), then a
// card for each food with its name, kcal, amount and protein and its own Edit, Save and Remove icons
// along its foot; its photo or image link; and, in a row of their own under "Whole meal", the icons that
// act on the whole meal: Insight (D-70), Edit, Save to my meals and Delete. Each icon is 44 to tap and
// named for screen readers; Remove and Delete are red.
export function LoggedMealCard({
  title,
  slotLabel,
  items,
  tags,
  totals,
  syncState,
  photo,
  savedAt,
  savedAs,
  foodsSavedAs,
  onInsight,
  onEdit,
  onSave,
  onDelete,
  onEditFood,
  onSaveFood,
  onRemoveFood,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.values}>
          <Text style={styles.kcal}>{formatKcal(totals.kcal)}</Text> · {formatGrams(totals.proteinG)} protein
        </Text>
        <Text style={styles.saved}>Saved {formatIstTime(savedAt)}</Text>
      </View>
      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {MEAL_TAG_LABELS[tag]}
            </Text>
          ))}
        </View>
      ) : null}
      {note ? <Text style={[styles.note, syncState === 'rejected' && styles.notSaved]}>{note}</Text> : null}
      {items.map((item, index) => {
        const foodSavedAs = foodsSavedAs[index] ?? null;
        return (
          // A meal may hold the same food twice, so the place keys it.
          <View key={index} testID="meal-food" style={styles.food}>
            <View
              accessible
              accessibilityLabel={`${item.name}: ${formatAmount(item.amount)}, ${formatKcal(item.kcal)}, ${formatGrams(item.proteinG)} protein`}
              style={styles.foodBody}
            >
              <View style={styles.foodFirstLine}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodKcal}>{formatKcal(item.kcal)}</Text>
              </View>
              <Text style={styles.foodDetail}>
                {formatAmount(item.amount)} · {formatGrams(item.proteinG)} protein
              </Text>
            </View>
            <View style={styles.foodActions}>
              <IconAction icon={SquarePen} size={19} label={`Edit ${item.name}`} color={colors.accent} onPress={() => onEditFood(index)} />
              <IconAction
                icon={Bookmark}
                size={19}
                label={foodSavedAs ? `${item.name}: saved to my meals as ${foodSavedAs}` : `Save ${item.name} to my meals`}
                color={colors.accent}
                filled={foodSavedAs !== null}
                onPress={() => onSaveFood(index)}
              />
              <IconAction icon={Trash} size={19} label={`Remove ${item.name} from ${slotLabel}`} color={colors.danger} onPress={() => onRemoveFood(index)} />
            </View>
          </View>
        );
      })}
      {photo ? (
        <View style={styles.photo}>
          <MealPhotoPreview mealId={photo.mealId} photo={photo.photo} />
        </View>
      ) : null}
      <View testID="whole-meal" style={styles.foot}>
        <Text style={styles.footLabel}>Whole meal</Text>
        <IconAction icon={ChartPie} label={`Insight: ${title}`} color={colors.accent} onPress={onInsight} />
        <IconAction icon={SquarePen} label={`Edit ${title}`} color={colors.accent} onPress={onEdit} />
        <IconAction
          icon={Bookmark}
          label={savedAs ? `${title}: saved to my meals as ${savedAs}` : `Save ${title} to my meals`}
          color={colors.accent}
          filled={savedAs !== null}
          onPress={onSave}
        />
        <IconAction icon={Trash} label={`Delete ${title}`} color={colors.danger} onPress={onDelete} />
      </View>
    </View>
  );
}

// As the canvas (3.1, D-97, A): the meal a tile with a hairline edge, 12 in from its sides; each food a
// card a step below it in the slot's own colour, its icons 44 along its foot at the right; the whole
// meal's row ruled off across the card, its label in condensed capitals.
const useStyles = themedStyles((c) => ({
  card: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  values: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  kcal: { ...TYPE.metric, fontSize: 18, color: c.ink },
  saved: { fontSize: 13, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', backgroundColor: c.accentTint, color: c.accent },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
  food: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  foodBody: { gap: 4, paddingTop: 10, paddingHorizontal: 12 },
  foodFirstLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  foodName: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  foodKcal: { ...TYPE.metric, fontSize: 18, lineHeight: 22 },
  foodDetail: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  foodActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 2 },
  photo: { flexDirection: 'row' },
  foot: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -12, paddingLeft: 12, paddingRight: 2, borderTopWidth: 1, borderTopColor: c.border },
  footLabel: { ...TYPE.label, flex: 1, color: c.inkMuted },
}));
