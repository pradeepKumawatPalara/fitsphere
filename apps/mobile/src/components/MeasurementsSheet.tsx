import {
  addDays,
  fromMillimetres,
  MEASUREMENT_NOTES_MAX,
  type IstDay,
  type LengthUnit,
  type MeasurementsSetData,
} from '@fitsphere/shared';
import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatDay, measurementRange, parseLength } from '../format';
import { useFieldChecks } from '../fieldChecks';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, getMeta, setMeta } from '../local/store';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useChoiceStyles, useFieldInputStyle, useFieldLabelStyle } from './ui';

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
// more than one entry for a date. Notes longer than 500 characters are not cut off: past 500, a red
// message under them says how many to remove, and Save waits (D-98). Since D-99 each problem shows once
// typing pauses or the field is left.
export function MeasurementsSheet({ mode, initialDay, today, firstDay, onSave, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fieldInput = useFieldInputStyle();
  const fieldLabel = useFieldLabelStyle();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const [day, setDay] = useState(initialDay);
  const [unit, setUnit] = useState<LengthUnit>('cm');
  const [texts, setTexts] = useState<Texts>(EMPTY);
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  // The length being typed in: its outline caramel.
  const [focused, setFocused] = useState<LengthKey | null>(null);
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
  // What is saved is trimmed, so spaces at either end do not count (D-98).
  const notesOver = notes.trim().length - MEASUREMENT_NOTES_MAX;
  // Each problem shows once typing pauses or the field is left (D-99).
  const checks = useFieldChecks({ ...texts, notes });
  const notesTooLong = notesOver > 0 && checks.shows('notes');
  const canSave =
    REQUIRED.every(({ key }) => typeof lengths[key] === 'number') && OPTIONAL.every(({ key }) => lengths[key] !== 'invalid') && notesOver <= 0;
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
    const refused = lengths[key] === 'invalid' && checks.shows(key);
    return (
      <View key={key} style={[styles.field, !guidance && styles.half]}>
        <View style={styles.labelRow}>
          <Text style={fieldLabel}>{label}</Text>
          {guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
        </View>
        <View style={[styles.box, focused === key && styles.boxFocused, refused && styles.boxRefused]}>
          <TextInput
            accessibilityLabel={`${label} (${unit})`}
            value={texts[key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
            onFocus={() => {
              setFocused(key);
              checks.focus(key);
            }}
            onBlur={() => {
              setFocused((current) => (current === key ? null : current));
              checks.blur(key);
            }}
            keyboardType="decimal-pad"
            style={styles.number}
          />
          <Text style={styles.unitText}>{unit}</Text>
        </View>
        {refused ? (
          <View style={styles.problem}>
            <CircleAlert size={16} color={colors.danger} />
            <Text accessibilityRole="alert" style={styles.problemText}>
              {rule}
            </Text>
          </View>
        ) : null}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close without saving"
            onPress={onClose}
            style={({ pressed }) => [styles.square, pressed && styles.pressed]}
          >
            <X size={20} strokeWidth={2.25} color={colors.inkMuted} />
          </Pressable>
        </View>
      }
      onClose={onClose}
      actions={
        <>
          <TextButton title="Save measurements" filled disabled={!canSave} busy={busy} onPress={() => void save()} />
          {REQUIRED.some(({ key }) => lengths[key] === 'empty') ? (
            <Text style={styles.hint}>Enter both waist values to save.</Text>
          ) : notesOver > 0 ? (
            <Text style={styles.hint}>Shorten the notes to save.</Text>
          ) : null}
        </>
      }
    >
      <View style={styles.dateRow}>
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
              style={({ pressed }) => [styles.square, day <= firstDay && styles.dimmed, pressed && styles.pressed]}
            >
              <ChevronLeft size={20} strokeWidth={2.25} color={day <= firstDay ? colors.inkSubtle : colors.accent} />
            </Pressable>
            <Text accessibilityLabel={`Date: ${formatDay(day)}`} style={[styles.date, styles.dateBetween]}>
              {formatDay(day)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: day >= today }}
              disabled={day >= today}
              onPress={() => setDay(addDays(day, 1))}
              style={({ pressed }) => [styles.square, day >= today && styles.dimmed, pressed && styles.pressed]}
            >
              <ChevronRight size={20} strokeWidth={2.25} color={day >= today ? colors.inkSubtle : colors.accent} />
            </Pressable>
          </View>
        )}
        <View style={styles.units}>
          {(['cm', 'in'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ selected: unit === option }}
              onPress={() => changeUnit(option)}
              style={({ pressed }) => [pill.choice, styles.unit, unit === option && pill.chosen, pressed && pill.pressed]}
            >
              <Text style={[pill.choiceText, unit === option && pill.chosenText]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {REQUIRED.map(({ key, label, guidance }) => lengthField(key, label, guidance))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More measurements"
        accessibilityState={{ expanded: showMore }}
        onPress={() => setShowMore((open) => !open)}
        style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
      >
        {showMore ? (
          <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
        ) : (
          <ChevronRight size={18} strokeWidth={2.25} color={colors.accent} />
        )}
        <Text style={styles.more}>More measurements</Text>
      </Pressable>
      {showMore ? (
        <>
          <View style={styles.halves}>{OPTIONAL.map(({ key, label }) => lengthField(key, label))}</View>
          <View style={styles.field}>
            <Text style={fieldLabel}>Notes</Text>
            <TextInput
              accessibilityLabel="Notes"
              value={notes}
              onChangeText={setNotes}
              onFocus={() => checks.focus('notes')}
              onBlur={() => checks.blur('notes')}
              multiline
              style={[fieldInput, styles.notes, notesTooLong && styles.notesRefused]}
            />
            {notesTooLong ? (
              <View style={styles.problem}>
                <CircleAlert size={16} color={colors.danger} />
                <Text accessibilityRole="alert" style={styles.problemText}>
                  Notes can be up to {MEASUREMENT_NOTES_MAX} characters. Remove {notesOver} {notesOver === 1 ? 'character' : 'characters'}.
                </Text>
              </View>
            ) : (
              <Text style={styles.guidance}>Up to {MEASUREMENT_NOTES_MAX} characters.</Text>
            )}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

// The redesign's 2.5 (locked by the owner, 2026-11-03): the title as the sheets' titles; the date
// between square arrows, cm/in as blocks beside it; each length in a sunken box with its unit, the
// optional ones two to a row. Close, the arrows and More measurements are 44 to tap.
const useStyles = themedStyles((c) => ({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { ...TYPE.sheetTitle, flexShrink: 1 },
  square: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dimmed: { opacity: 0.45 },
  date: { ...TYPE.metric, fontVariant: ['tabular-nums'] },
  dateBetween: { minWidth: 96, textAlign: 'center' },
  units: { flexDirection: 'row', gap: 6 },
  unit: { width: 52, paddingHorizontal: 0 },
  pressed: { opacity: 0.6 },
  field: { gap: 6 },
  half: { flexBasis: '45%', flexGrow: 1 },
  halves: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  guidance: { color: c.inkMuted, fontSize: 13, lineHeight: 18 },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxFocused: { borderColor: c.accent },
  boxRefused: { borderColor: c.danger },
  number: { ...TYPE.input, flex: 1, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  unitText: { ...TYPE.label, fontSize: 14, color: c.inkMuted },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  notesRefused: { borderColor: c.danger },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  problemText: { ...TYPE.small, flexShrink: 1, color: c.danger },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  moreButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { ...TYPE.link, color: c.accent },
}));
