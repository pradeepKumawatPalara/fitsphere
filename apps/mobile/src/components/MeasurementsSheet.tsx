import {
  addDays,
  fromMillimetres,
  MEASUREMENT_NOTES_MAX,
  type IstDay,
  type LengthUnit,
  type MeasurementsSetData,
} from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDay, measurementRange, parseLength } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, getMeta, setMeta } from '../local/store';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle, useFieldLabelStyle } from './ui';

type LengthKey = 'upperWaistMm' | 'lowerWaistMm' | 'chestMm' | 'hipsMm' | 'armMm' | 'thighMm';
type Texts = Record<LengthKey, string>;
export type MeasurementsInput = Omit<MeasurementsSetData, 'recordedAt'>;

const REQUIRED: { key: LengthKey; label: string; guidance: string }[] = [
  { key: 'upperWaistMm', label: 'Upper waist', guidance: '2 fingers above the navel' },
  { key: 'lowerWaistMm', label: 'Lower waist', guidance: '2 fingers below the navel' },
];
const OPTIONAL: { key: LengthKey; label: string }[] = [
  { key: 'chestMm', label: 'Chest' },
  { key: 'hipsMm', label: 'Hips' },
  { key: 'armMm', label: 'Arms' },
  { key: 'thighMm', label: 'Thighs' },
];
const EMPTY: Texts = { upperWaistMm: '', lowerWaistMm: '', chestMm: '', hipsMm: '', armMm: '', thighMm: '' };

type Props = {
  /**
   * `add`: opens on Home's selected date, which can be moved to other past days (REQ-MEAS-002).
   * `edit`: corrects the entry of `initialDay`; the date is fixed, so a correction stays with its
   * date (D-24).
   */
  mode: 'add' | 'edit';
  /** The day it opens on: Home's selected date (MVP default, D-23). */
  initialDay: IstDay;
  today: IstDay;
  /** The earliest day that can be chosen (the phone's 90 days; D-23). */
  firstDay: IstDay;
  onSave(input: MeasurementsInput): Promise<void>;
  onClose(): void;
};

// The measurements sheet (REQ-MEAS-001…006): a date (past days only, Q-017), a cm/in toggle, the
// two mandatory waist values and, under "More measurements", chest, hips, arms, thighs (one value
// each, Q-027) and notes. "Save measurements" is enabled only once both waist values are valid and
// every other value entered is valid (10–250 cm, Q-028). X closes without saving or a warning
// (Q-029). A day's existing entry fills the sheet; saving replaces it (Q-030), so there is never
// more than one entry for a date.
export function MeasurementsSheet({ mode, initialDay, today, firstDay, onSave, onClose }: Props) {
  const styles = useStyles();
  const fieldInput = useFieldInputStyle();
  const fieldLabel = useFieldLabelStyle();
  const local = useLocalDatabase();
  const [day, setDay] = useState(initialDay);
  const [unit, setUnit] = useState<LengthUnit>('cm');
  const [texts, setTexts] = useState<Texts>(EMPTY);
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);

  // The day's entry, in the unit last chosen on this phone (MVP default, D-23).
  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([getMeta(db, 'measurement_unit'), getEntry(db, 'measurements', day)]).then(([saved, entry]) => {
      if (!active) return;
      const shownUnit: LengthUnit = saved === 'in' ? 'in' : 'cm';
      setUnit(shownUnit);
      if (!entry) {
        setTexts(EMPTY);
        setNotes('');
        return;
      }
      const toText = (mm: number | null) => (mm === null ? '' : fromMillimetres(mm, shownUnit).toFixed(1));
      setTexts({
        upperWaistMm: toText(entry.upperWaistMm),
        lowerWaistMm: toText(entry.lowerWaistMm),
        chestMm: toText(entry.chestMm),
        hipsMm: toText(entry.hipsMm),
        armMm: toText(entry.armMm),
        thighMm: toText(entry.thighMm),
      });
      setNotes(entry.notes ?? '');
      if (OPTIONAL.some(({ key }) => entry[key] !== null) || entry.notes) setShowMore(true);
    });
    return () => {
      active = false;
    };
  }, [local.state, day]);

  /** Switching the unit converts what is typed, so each value keeps its meaning. */
  function changeUnit(next: LengthUnit) {
    if (next === unit) return;
    setTexts((current) => {
      const converted = { ...current };
      for (const key of Object.keys(current) as LengthKey[]) {
        const mm = parseLength(current[key], unit);
        if (mm !== null) converted[key] = fromMillimetres(mm, next).toFixed(1);
      }
      return converted;
    });
    setUnit(next);
    if (local.state.status === 'ready') void setMeta(local.state.db, 'measurement_unit', next);
  }

  const lengths = Object.fromEntries(
    (Object.keys(texts) as LengthKey[]).map((key) => [key, texts[key].trim() === '' ? 'empty' : (parseLength(texts[key], unit) ?? 'invalid')]),
  ) as Record<LengthKey, number | 'empty' | 'invalid'>;
  const canSave =
    REQUIRED.every(({ key }) => typeof lengths[key] === 'number') && OPTIONAL.every(({ key }) => lengths[key] !== 'invalid');
  const range = measurementRange(unit);
  const rule = `Enter ${range.min.toFixed(1)} to ${range.max.toFixed(1)} ${unit}.`;

  async function save() {
    const length = (key: LengthKey) => {
      const value = lengths[key];
      return typeof value === 'number' ? value : null;
    };
    setBusy(true);
    await onSave({
      day,
      upperWaistMm: length('upperWaistMm')!,
      lowerWaistMm: length('lowerWaistMm')!,
      chestMm: length('chestMm'),
      hipsMm: length('hipsMm'),
      armMm: length('armMm'),
      thighMm: length('thighMm'),
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setBusy(false);
    onClose();
  }

  function lengthField(key: LengthKey, label: string, guidance?: string) {
    return (
      <View key={key} style={styles.field}>
        <Text style={fieldLabel}>{label}</Text>
        {guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel={`${label} (${unit})`}
            value={texts[key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
            keyboardType="decimal-pad"
            style={[fieldInput, styles.grow, styles.number]}
          />
          <Text style={styles.unitText}>{unit}</Text>
        </View>
        {lengths[key] === 'invalid' ? <Text style={styles.problem}>{rule}</Text> : null}
      </View>
    );
  }

  return (
    <Sheet
      header={
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={styles.title}>
            {mode === 'edit' ? 'Edit measurements' : 'Measurements'}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close without saving" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      }
      onClose={onClose}
      actions={<TextButton title="Save measurements" filled disabled={!canSave || busy} onPress={() => void save()} />}
    >
      {mode === 'edit' ? (
        <Text accessibilityLabel={`Date: ${formatDay(day)}`} style={styles.date}>
          {formatDay(day)}
        </Text>
      ) : (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            accessibilityState={{ disabled: day <= firstDay }}
            disabled={day <= firstDay}
            onPress={() => setDay(addDays(day, -1))}
            style={styles.arrow}
          >
            <Text style={[styles.arrowText, day <= firstDay && styles.disabledText]}>‹</Text>
          </Pressable>
          <Text accessibilityLabel={`Date: ${formatDay(day)}`} style={styles.date}>
            {formatDay(day)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: day >= today }}
            disabled={day >= today}
            onPress={() => setDay(addDays(day, 1))}
            style={styles.arrow}
          >
            <Text style={[styles.arrowText, day >= today && styles.disabledText]}>›</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        {(['cm', 'in'] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected: unit === option }}
            onPress={() => changeUnit(option)}
            style={[styles.unit, unit === option && styles.unitSelected]}
          >
            <Text style={unit === option ? styles.unitSelectedText : undefined}>{option}</Text>
          </Pressable>
        ))}
      </View>
      {REQUIRED.map(({ key, label, guidance }) => lengthField(key, label, guidance))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More measurements"
        accessibilityState={{ expanded: showMore }}
        onPress={() => setShowMore((open) => !open)}
        style={styles.moreButton}
      >
        <Text style={styles.more}>{showMore ? '▾' : '▸'} More measurements</Text>
      </Pressable>
      {showMore ? (
        <>
          {OPTIONAL.map(({ key, label }) => lengthField(key, label))}
          <View style={styles.field}>
            <Text style={fieldLabel}>Notes</Text>
            <TextInput
              accessibilityLabel="Notes"
              value={notes}
              onChangeText={setNotes}
              maxLength={MEASUREMENT_NOTES_MAX}
              multiline
              style={[fieldInput, styles.notes]}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

// The title as the sheets' titles; fields as Field; cm/in as choice pills (40 tall, the chosen one
// filled). Close, the arrows and More measurements are 44 to tap.
const useStyles = themedStyles((c) => ({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 24 },
  disabledText: { color: c.textFaint },
  date: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unit: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: c.textFaint },
  unitSelected: { backgroundColor: c.primary, borderColor: c.primary },
  unitSelectedText: { color: c.onPrimary, fontWeight: '600' },
  field: { gap: 6 },
  guidance: { marginTop: -4, color: c.textMuted, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `grow` only in a row: in a column, flex: 1 holds Notes at its minimum height.
  grow: { flex: 1 },
  number: { fontVariant: ['tabular-nums'] },
  unitText: { fontSize: 15, color: c.textMuted },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  problem: { fontSize: 13, color: c.error },
  moreButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  more: { fontSize: 15, color: c.primary, fontWeight: '600' },
}));
