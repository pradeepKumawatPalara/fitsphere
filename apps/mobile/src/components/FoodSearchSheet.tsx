import { IFCT_ACKNOWLEDGEMENT, type Food, type MealItem } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { Button, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchFoods } from '../local/store';
import { GRAMS_RULE, itemFromFood, parseGrams } from '../mealItems';
import { formatGrams, formatKcal } from '../meals';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1), then the grams eaten. Food values are per 100 g; IFCT's acknowledgement is
// shown under the results (D-25).
export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const local = useLocalDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [listCached, setListCached] = useState(true);
  const [chosen, setChosen] = useState<Food | null>(null);
  const [gramsText, setGramsText] = useState('100');

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([searchFoods(db, query), getMeta(db, 'food_list_version')]).then(([found, version]) => {
      if (!active) return;
      setResults(found);
      setListCached(version !== null);
    });
    return () => {
      active = false;
    };
  }, [local.state, query]);

  const grams = parseGrams(gramsText);
  const preview = chosen && grams !== null ? itemFromFood(chosen, grams) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {chosen ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                {chosen.name}
              </Text>
              <Text>
                Per 100 g: {formatKcal(chosen.kcal)}
                {chosen.kcalEstimated ? ' (estimated)' : ''} · {formatGrams(chosen.proteinG)} protein
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Grams eaten"
                  value={gramsText}
                  onChangeText={setGramsText}
                  keyboardType="number-pad"
                  autoFocus
                  style={styles.input}
                />
                <Text>g</Text>
              </View>
              {preview ? (
                <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`}>
                  = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
                </Text>
              ) : (
                <Text accessibilityRole="alert" style={styles.problem}>
                  {GRAMS_RULE}
                </Text>
              )}
              <Button
                title="Add"
                disabled={!preview}
                onPress={() => {
                  if (!preview) return;
                  onAdd(preview);
                  onClose();
                }}
              />
              <Button title="Back to search" onPress={() => setChosen(null)} />
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                Search foods
              </Text>
              <TextInput
                accessibilityLabel="Search foods"
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. atta, dal, paneer"
                autoFocus
                style={styles.input}
              />
              {!listCached ? (
                <Text accessibilityRole="alert">{TEXTS.needsInternet('Downloading the food list')}</Text>
              ) : query.trim() !== '' && results.length === 0 ? (
                <Text>No foods found. Try another word, or enter your own food.</Text>
              ) : null}
              <FlatList
                data={results}
                keyExtractor={(food) => `${food.source}:${food.code}`}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: food }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${food.name}, ${formatKcal(food.kcal)} per 100 g${food.kcalEstimated ? ', estimated' : ''}`}
                    onPress={() => {
                      setChosen(food);
                      setGramsText('100');
                    }}
                    style={styles.row}
                  >
                    <Text style={styles.name}>{food.name}</Text>
                    <Text style={styles.detail}>
                      {formatKcal(food.kcal)} per 100 g{food.kcalEstimated ? ' · estimated' : ''}
                    </Text>
                  </Pressable>
                )}
              />
              <Text style={styles.acknowledgement}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
              <Button title="Close" onPress={onClose} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '90%', backgroundColor: '#fff', padding: 20, gap: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  list: { maxHeight: 360 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  name: { fontWeight: '600' },
  detail: { color: '#555', fontSize: 13 },
  acknowledgement: { color: '#666', fontSize: 11 },
  problem: { color: '#b00020' },
});
