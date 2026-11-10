import { EXERCISE_CATEGORIES, EXERCISE_SUB_GROUPS } from '@fitsphere/shared';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { formatInteger } from '../format';
import type { ExerciseFilter, ExercisePlaceCounts } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, useFieldLabelStyle } from './ui';

type Which = 'category' | 'subGroup';

type Props = {
  filter: ExerciseFilter;
  /** The list's counts, once read; until then the choices show without them. */
  counts: ExercisePlaceCounts | null;
  /** The picker whose list is open, if any. */
  open: Which | null;
  onOpen(which: Which | null): void;
  onChange(filter: ExerciseFilter): void;
};

/** A category's sub-groups, in the library's order; none for a category without them (D-67). */
export function subGroupsOf(category: string): readonly string[] {
  return (EXERCISE_SUB_GROUPS as Readonly<Record<string, readonly string[]>>)[category] ?? [];
}

/** Every sub-group name of the library, A to Z, each once ("Chest" is Barbell's, Dumbbell's, Cable's and Machine's). */
const ALL_SUB_GROUPS = [...new Set(Object.values(EXERCISE_SUB_GROUPS).flat())].sort((a, b) => a.localeCompare(b));

/** What a filter is called: "Barbell · Chest", "Barbell" or "Chest". */
export function filterLabel(filter: ExerciseFilter): string {
  return [filter.category, filter.subGroup].filter((part) => part !== null).join(' · ');
}

// The exercise sheet's Category and Sub-group (the redesign's 4.3, changed by D-67; locked by the owner
// 2026-11-10): side by side above the name, each a field with its value and a chevron that opens its
// list under them, each choice with its count and a tick on the chosen one; "All categories" and "All
// sub-groups" clear the choice. Sub-group follows the category: its sub-groups, or every sub-group name
// A to Z with none chosen; a category with none reads "No sub-groups" and does not open. Changing the
// category clears a sub-group it does not have.
export function ExercisePlacePickers({ filter, counts, open, onOpen, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const labelStyle = useFieldLabelStyle();
  const noSubGroups = filter.category !== null && subGroupsOf(filter.category).length === 0;

  const count = (value: number | undefined) => (counts && value !== undefined ? value : null);
  const options: { value: string | null; label: string; count: number | null }[] =
    open === 'category'
      ? [
          { value: null, label: 'All categories', count: count(counts?.total) },
          ...EXERCISE_CATEGORIES.map((category) => ({ value: category, label: category, count: count(counts?.byCategory.get(category) ?? 0) })),
        ]
      : open === 'subGroup'
        ? [
            {
              value: null,
              label: 'All sub-groups',
              count: count(filter.category === null ? counts?.total : (counts?.byCategory.get(filter.category) ?? 0)),
            },
            ...(filter.category === null ? ALL_SUB_GROUPS : subGroupsOf(filter.category)).map((subGroup) => ({
              value: subGroup,
              label: subGroup,
              count: count(
                filter.category === null ? (counts?.bySubGroup.get(subGroup) ?? 0) : (counts?.byPlace.get(`${filter.category}>${subGroup}`) ?? 0),
              ),
            })),
          ]
        : [];
  const chosen = open === 'category' ? filter.category : filter.subGroup;

  function choose(value: string | null) {
    if (open === 'category') {
      const keeps = value !== null && filter.subGroup !== null && subGroupsOf(value).includes(filter.subGroup);
      onChange({ category: value, subGroup: keeps || value === null ? filter.subGroup : null });
    } else {
      onChange({ ...filter, subGroup: value });
    }
    onOpen(null);
  }

  const field = (which: Which, label: string, value: string, set: boolean, disabled: boolean) => {
    const isOpen = open === which;
    return (
      <View style={styles.half}>
        <Text style={labelStyle}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
          accessibilityState={{ expanded: isOpen, disabled }}
          disabled={disabled}
          onPress={() => onOpen(isOpen ? null : which)}
          style={({ pressed }) => [styles.box, isOpen && styles.focused, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={[styles.value, set && styles.chosenValue]}>
            {value}
          </Text>
          {isOpen ? (
            <ChevronUp size={20} strokeWidth={2.25} color={colors.accent} />
          ) : (
            <ChevronDown size={20} strokeWidth={2.25} color={disabled ? colors.inkSubtle : colors.accent} />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {field('category', 'Category', filter.category ?? 'All categories', filter.category !== null, false)}
        {field('subGroup', 'Sub-group', noSubGroups ? 'No sub-groups' : (filter.subGroup ?? 'All sub-groups'), filter.subGroup !== null, noSubGroups)}
      </View>
      {open ? (
        <View accessibilityLabel={open === 'category' ? 'Categories' : 'Sub-groups'} style={styles.list}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {options.map((option, index) => {
              const isChosen = option.value === chosen;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityLabel={option.count === null ? option.label : `${option.label}, ${formatInteger(option.count)} ${option.count === 1 ? 'exercise' : 'exercises'}`}
                  accessibilityState={{ selected: isChosen }}
                  onPress={() => choose(option.value)}
                  style={({ pressed }) => [styles.option, index > 0 && styles.divided, pressed && styles.pressed]}
                >
                  <View style={styles.tick}>{isChosen ? <Check size={18} strokeWidth={2.5} color={colors.accent} /> : null}</View>
                  <Text style={[styles.optionLabel, isChosen && styles.optionChosen]}>{option.label}</Text>
                  <Text style={styles.count}>{option.count === null ? '' : formatInteger(option.count)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

// As the sheet's fields (2.4): sunken boxes with the muted outline, caramel when open; the list as the
// matches' panel, raised, its rows ruled.
const useStyles = themedStyles((c) => ({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0, gap: 8 },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  focused: { borderColor: c.accent },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.6 },
  value: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, color: c.inkMuted },
  chosenValue: { color: c.ink, fontWeight: '600' },
  list: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  scroll: { maxHeight: 360 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  tick: { width: 18 },
  optionLabel: { flex: 1, fontSize: 16, lineHeight: 22 },
  optionChosen: { fontWeight: '700' },
  count: { ...TYPE.label, fontSize: 15, lineHeight: 20, letterSpacing: 0, color: c.inkMuted, fontVariant: ['tabular-nums'] },
}));
