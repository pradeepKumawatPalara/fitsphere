import type { MealItem, MealTag, MealTotals } from '@fitsphere/shared';
import { SquarePen, Trash, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { SyncState } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

type Props = {
  /** What the card's actions are named after for screen readers: the saved meal's name. */
  title: string;
  /** The saved meal's name, shown over its foods (the redesign's 3.3). */
  name: string;
  items: MealItem[];
  tags: MealTag[];
  totals: MealTotals;
  syncState: SyncState;
  /** Opens the saved meal to change (D-69). */
  onEdit(): void;
  /** Asks first ("Delete this saved meal?"), then deletes. */
  onDelete(): void;
  /** Logs the saved meal (D-69). */
  onPress(): void;
};

// One saved meal on Nutrition › Saved (REQ-SAVED-001…003): its name over its foods, its kcal and
// protein, a small label per tag (Q-031), and Edit (D-69) and Delete at the top right, beside its
// name. Tapping the card logs it. Each icon is 44 to tap and named for screen readers; Delete is red.
// The redesign's 3.3 (locked by the owner, 2026-11-03). A logged meal has its own card
// (LoggedMealCard, D-97).
export function MealCard({ title, name, items, tags, totals, syncState, onEdit, onDelete, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.items}>{describeItems(items)}</Text>
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
        <View style={styles.inlineAction}>
          <IconAction icon={SquarePen} label={`Edit ${title}`} color={colors.accent} onPress={onEdit} />
          <IconAction icon={Trash} label={`Delete ${title}`} color={colors.danger} onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

/** An icon button, 44 to tap, named for screen readers; filled in its colour when done already (a meal saved). */
export function IconAction({
  icon: Icon,
  label,
  color,
  size = 20,
  filled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  size?: number;
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
      <Icon testID="icon" size={size} color={color} fill={filled ? color : 'none'} />
    </Pressable>
  );
}

// On the screen itself, in the card's own colour with no edge; kcal and protein in fixed-width digits;
// Edit and Delete at the top right, each 44, the card closing 12 below.
const useStyles = themedStyles((c) => ({
  card: { paddingTop: 14, paddingBottom: 12, paddingLeft: 16, paddingRight: 4, borderRadius: 4, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inlineAction: { flexDirection: 'row', marginTop: -12 },
  body: { flex: 1, gap: 6 },
  pressed: { opacity: 0.6 },
  name: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
  items: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: c.inkMuted },
  values: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  kcal: { ...TYPE.metric, fontSize: 18, color: c.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', backgroundColor: c.accentTint, color: c.accent },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
