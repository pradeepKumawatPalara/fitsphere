import type { MealItem, MealPhoto, MealTag, MealTotals } from '@fitsphere/shared';
import { Bookmark, SquarePen, Trash, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { formatIstTime } from '../format';
import type { SyncState } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { MealPhotoPreview } from './MealPhotoPreview';
import { Text } from './ui';

type Props = {
  /** What the card's actions are named after for screen readers, e.g. "Lunch: Wheat flour, atta". */
  title: string;
  /** A saved meal's name, shown over its foods (the redesign's 3.3). */
  name?: string;
  /** On the screen itself rather than inside a meal slot: the card's own colour, no edge. */
  standalone?: boolean;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  /** A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010); saved meals have none. */
  photo?: { mealId: string; photo: MealPhoto } | null;
  /** When a logged meal was last saved, shown as "Saved 8:15 am" in India time (D-34). */
  savedAt?: string;
  /** A logged meal: opens it in Log meal. A saved meal (D-69): opens it to change. */
  onEdit?(): void;
  /** A logged meal: "Save to my meals". */
  onSave?(): void;
  /** The saved meal's name when this logged meal is already saved: its bookmark is filled. */
  savedAs?: string | null;
  /** Asks first ("Delete this meal?"), then deletes. */
  onDelete(): void;
  onPress?(): void;
};

// One logged or saved meal (REQ-NUT-003, REQ-NUT-004, REQ-SAVED-001): its foods, kcal and protein,
// a small label per tag (Q-031), its photo or image link, and its actions as icons: Edit, Save to my
// meals and Delete along the foot of a logged meal's card; a saved meal's, Edit (D-69) and Delete, at
// the top right, beside its name. Each icon is 44 to tap and named for screen readers; Delete
// is red. The redesign's 3.1 and 3.3 (locked by the owner, 2026-11-03): the kcal in condensed figures,
// tags as small caramel blocks, a saved meal's name over its foods.
export function MealCard({
  title,
  name,
  standalone = false,
  items,
  tags,
  totals,
  syncState,
  photo,
  savedAt,
  onEdit,
  onSave,
  savedAs = null,
  onDelete,
  onPress,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  // A saved meal (no Save to my meals): its actions sit on the first line rather than a row of their own.
  const deleteOnly = !onSave;
  const remove = <IconAction icon={Trash} label={`Delete ${title}`} color={colors.danger} onPress={onDelete} />;
  const edit = onEdit ? <IconAction icon={SquarePen} label={`Edit ${title}`} color={colors.accent} onPress={onEdit} /> : null;
  return (
    <View style={[styles.card, standalone && styles.standalone, deleteOnly && styles.cardDeleteOnly]}>
      <View style={[styles.top, deleteOnly && styles.topDeleteOnly]}>
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={onPress ? title : undefined}
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          {name ? <Text style={styles.name}>{name}</Text> : null}
          <View style={styles.firstLine}>
            <Text style={[styles.items, name ? styles.itemsUnderName : null]}>{describeItems(items)}</Text>
            {savedAt ? <Text style={styles.saved}>Saved {formatIstTime(savedAt)}</Text> : null}
          </View>
          <Text style={styles.values}>
            <Text style={styles.kcal}>{formatKcal(totals.kcal)}</Text> · {formatGrams(totals.proteinG)} protein
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
          {note ? <Text style={[styles.note, syncState === 'rejected' && styles.notSaved]}>{note}</Text> : null}
        </Pressable>
        {deleteOnly ? (
          <View style={styles.inlineAction}>
            {edit}
            {remove}
          </View>
        ) : null}
      </View>
      {deleteOnly ? null : (
        <View style={[styles.actions, photo ? styles.actionsWithPhoto : null]}>
          {photo ? (
            <View style={styles.photo}>
              <MealPhotoPreview mealId={photo.mealId} photo={photo.photo} />
            </View>
          ) : null}
          {edit}
          {onSave ? (
            <IconAction
              icon={Bookmark}
              label={savedAs ? `${title}: saved to my meals as ${savedAs}` : `Save ${title} to my meals`}
              color={colors.accent}
              filled={savedAs !== null}
              onPress={onSave}
            />
          ) : null}
          {remove}
        </View>
      )}
    </View>
  );
}

function IconAction({
  icon: Icon,
  label,
  color,
  filled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  /** Filled in its colour: done already (a meal saved). */
  filled?: boolean;
  onPress(): void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={filled ? { selected: true } : {}}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Icon testID="icon" size={20} color={color} fill={filled ? color : 'none'} />
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
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  standalone: { paddingTop: 14, paddingLeft: 16, borderWidth: 0, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingRight: 10 },
  // A saved meal: Edit and Delete at the top right, beside its name; the card closes 12 below.
  cardDeleteOnly: { paddingBottom: 12 },
  topDeleteOnly: { paddingRight: 0 },
  inlineAction: { flexDirection: 'row', marginTop: -12 },
  body: { flex: 1, gap: 6 },
  pressed: { opacity: 0.6 },
  firstLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
  items: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  itemsUnderName: { fontSize: 15, fontWeight: '400', color: c.inkMuted },
  saved: { fontSize: 13, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  values: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  kcal: { ...TYPE.metric, fontSize: 18, color: c.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', backgroundColor: c.accentTint, color: c.accent },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  // The redesign's 3.9: a logged meal's photo or link at the left of its icons.
  actionsWithPhoto: { alignItems: 'center', gap: 8, marginTop: 4, paddingBottom: 6 },
  photo: { flex: 1, minWidth: 0, flexDirection: 'row' },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
