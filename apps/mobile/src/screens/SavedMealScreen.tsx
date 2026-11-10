import { istToday, mealTotals, SAVED_MEAL_NAME_MAX, type MealTag } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, Plus, SquarePen } from 'lucide-react-native';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FoodSearchSheet } from '../components/FoodSearchSheet';
import { MealFoodRows, useMealFoods } from '../components/MealFoods';
import { AlreadySavedSheet, SAVED_NAME_HINT, SaveMealSheet } from '../components/MealSheets';
import { Text, TextButton } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listSavedMeals, type LocalSavedMeal } from '../local/store';
import { sameFoods } from '../mealItems';
import { formatGrams, formatKcal } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

type Params = { name?: string; savedId?: string };
type Sheet = 'search' | 'name' | { already: string };

// A saved meal (REQ-SAVED-003, D-69): the user's own name, given first in Saved's "Create a saved
// meal", and its foods, each added as in Search foods and changed on its own page, as in Log meal. It
// has no meal of its own: it is logged to whichever meal the user chooses. Opened with `name` to make
// a new one, or with `savedId` to change one. The same foods and amounts are never saved twice
// (REQ-SAVED-001). Works offline.
export function SavedMealScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // The fixed footer clears the phone's navigation bar; none outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const today = istToday(now());
  const editing = typeof params.savedId === 'string' && params.savedId !== '';

  const [id] = useState(() => (editing ? params.savedId! : sync.newId()));
  const [name, setName] = useState(() => (typeof params.name === 'string' ? params.name.trim().slice(0, SAVED_MEAL_NAME_MAX) : ''));
  // Tags stay hidden until coaches (D-40); a saved meal changed here keeps the ones it has.
  const [tags, setTags] = useState<MealTag[]>([]);
  const { items, setItems, addItems, change, sheets } = useMealFoods();
  const [saved, setSaved] = useState<LocalSavedMeal[]>([]);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit: the saved meal as it is on the phone.
  useEffect(() => {
    if (!editing || local.state.status !== 'ready') return;
    let active = true;
    void getEntry(local.state.db, 'savedMeal', id).then((entry) => {
      if (!active) return;
      if (!entry) {
        setMissing(true);
        return;
      }
      setName(entry.name);
      setTags(entry.tags);
      setItems(entry.items);
    });
    return () => {
      active = false;
    };
  }, [editing, id, local.state, setItems]);

  // The other saved meals, so the same foods are not saved twice.
  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listSavedMeals(local.state.db).then((entries) => {
      if (active) setSaved(entries);
    });
    return () => {
      active = false;
    };
  }, [local.state, sync.version]);

  async function save() {
    if (name === '' || items.length === 0) return;
    const same = saved.find((entry) => entry.id !== id && sameFoods(entry.items, items));
    if (same) {
      setSheet({ already: same.name });
      return;
    }
    setBusy(true);
    await sync.save('savedMeal', { id, name, tags, items });
    setBusy(false);
    router.back();
  }

  if (missing) {
    return (
      <View style={styles.missing}>
        <Text accessibilityRole="alert">This saved meal is no longer on this phone.</Text>
        <TextButton title="Back" outlined onPress={() => router.back()} />
      </View>
    );
  }

  const totals = mealTotals(items);
  const hint = name === '' ? 'Give the meal a name.' : items.length === 0 ? 'Add at least one food to save the meal.' : null;
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.nameCard}>
          <View style={styles.nameWords}>
            <Text style={styles.nameLabel}>Name</Text>
            <Text accessibilityRole="header" style={[styles.name, name === '' && styles.noName]}>
              {name === '' ? 'No name yet' : name}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change the name"
            onPress={() => setSheet('name')}
            style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
          >
            <SquarePen size={20} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.foods}>
          <Text accessibilityRole="header" style={styles.foodsTitle}>
            {items.length > 0 ? `Foods · ${items.length}` : 'Foods'}
          </Text>
          {items.length === 0 ? (
            <View accessibilityLiveRegion="polite" style={styles.cue}>
              <ArrowDown size={18} strokeWidth={2.25} color={colors.accent} />
              <Text style={styles.cueText}>Next: tap Add food to find each food</Text>
            </View>
          ) : null}
          <MealFoodRows items={items} onChange={(index) => void change(index)} />
          <TextButton title="Add food" outlined wide icon={Plus} onPress={() => setSheet('search')} />
        </View>
      </ScrollView>

      {/* Fixed below the list, so the total and Save stay in reach however many foods are added. */}
      <View style={[styles.footer, { paddingBottom: 12 + (insets?.bottom ?? 0) }]}>
        {items.length > 0 ? (
          <View accessible accessibilityLabel={`Total: ${formatKcal(totals.kcal)}, ${formatGrams(totals.proteinG)} protein`} style={styles.total}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalKcal}>{formatKcal(totals.kcal)}</Text>
            <Text style={styles.totalProtein}>· {formatGrams(totals.proteinG)} protein</Text>
          </View>
        ) : null}
        <TextButton
          title={editing ? 'Save changes' : 'Save meal'}
          filled
          disabled={hint !== null}
          busy={busy}
          onPress={() => void save()}
        />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      {sheet === 'search' ? <FoodSearchSheet today={today} onAdd={addItems} onClose={() => setSheet(null)} /> : null}
      {sheet === 'name' ? (
        <SaveMealSheet
          initialName={name}
          title={name === '' ? 'New saved meal' : 'Change the name'}
          actionLabel="Done"
          emptyHint={SAVED_NAME_HINT}
          onSave={setName}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {typeof sheet === 'object' && sheet !== null ? (
        <AlreadySavedSheet
          intro="These foods and amounts are already saved as"
          savedAs={sheet.already}
          onGoToSaved={() => router.back()}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheets}
    </View>
  );
}

// As Log meal: 16 at the sides, 22 between the groups; the name on its card in condensed capitals with
// its pencil; the foods ruled on a card, Add food outlined under them; the total over Save in the
// fixed footer.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 22 },
  missing: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  nameCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingLeft: 16, paddingRight: 4, borderRadius: 4, backgroundColor: c.surface },
  nameWords: { flex: 1, gap: 4 },
  nameLabel: { ...TYPE.label, color: c.inkMuted },
  name: { ...TYPE.metric, fontSize: 26, lineHeight: 28 },
  noName: { color: c.inkMuted },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  foods: { gap: 10 },
  foodsTitle: { ...TYPE.label, fontSize: 15, lineHeight: 18, color: c.ink },
  cue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cueText: { ...TYPE.link, flexShrink: 1, letterSpacing: 0.5, color: c.accent },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  totalLabel: { ...TYPE.label, color: c.inkMuted },
  totalKcal: TYPE.metric,
  totalProtein: { fontSize: 14, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
}));
