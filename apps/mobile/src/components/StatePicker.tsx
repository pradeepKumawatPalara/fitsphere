import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { INDIAN_STATES, listedState, PROFILE_TEXTS, UNION_TERRITORIES } from '../profile';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Text, TextButton } from './ui';

// The address's State (D-109, the owner, 2026-11-16: "state input should be dropdown with all indian
// state + indian Kendra shashit pradesh"): a box like the other address boxes with a down arrow; a tap
// opens a sheet listing India's 28 states, then its 8 union territories, the chosen one ticked; a tap
// on one chooses it and closes the sheet. Clear empties it, as the address is optional. A state saved
// before D-109 that is not on the list shows as saved, and the sheet says so, until one is chosen.

type Props = {
  value: string;
  refused: boolean;
  onChange(state: string): void;
  /** For the field checks (D-99): the sheet open counts as typing in the field, closed as leaving it. */
  onFocus(): void;
  onBlur(): void;
};

export function StatePicker({ value, refused, onChange, onFocus, onBlur }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const chosen = value.trim();

  function close() {
    setOpen(false);
    onBlur();
  }

  function choose(state: string) {
    onChange(state);
    close();
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`State: ${chosen || 'not chosen'}`}
        accessibilityHint="Opens the list of states and union territories"
        onPress={() => {
          onFocus();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.box, refused && styles.boxRefused, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.value, chosen === '' && styles.placeholder]}>
          {chosen || 'State'}
        </Text>
        <ChevronDown size={20} strokeWidth={2.25} color={colors.accent} />
      </Pressable>
      {open ? (
        <Sheet
          title="State"
          onClose={close}
          actions={chosen ? <TextButton title="Clear state" outlined wide onPress={() => choose('')} /> : undefined}
        >
          {chosen && listedState(chosen) === null ? <Text style={styles.note}>{PROFILE_TEXTS.stateNotListed(chosen)}</Text> : null}
          <StateGroup title="States" states={INDIAN_STATES} chosen={chosen} onChoose={choose} />
          <StateGroup title="Union territories" states={UNION_TERRITORIES} chosen={chosen} onChoose={choose} />
        </Sheet>
      ) : null}
    </>
  );
}

function StateGroup({ title, states, chosen, onChoose }: { title: string; states: readonly string[]; chosen: string; onChoose(state: string): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>
        {title}
      </Text>
      <View style={styles.list}>
        {states.map((state, index) => {
          const isChosen = state === chosen;
          return (
            <Pressable
              key={state}
              accessibilityRole="radio"
              accessibilityLabel={state}
              accessibilityState={{ checked: isChosen }}
              onPress={() => onChoose(state)}
              style={({ pressed }) => [styles.option, index > 0 && styles.divided, pressed && styles.pressed]}
            >
              <View style={styles.tick}>{isChosen ? <Check size={18} strokeWidth={2.5} color={colors.accent} /> : null}</View>
              <Text style={[styles.optionLabel, isChosen && styles.optionChosen]}>{state}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The box as the Profile screen's address boxes (6.2): sunken, the muted outline, red when refused; the
// list as Add exercise's Category list (D-67): raised, its rows ruled, the chosen one ticked and bold.
const useStyles = themedStyles((c) => ({
  box: {
    flex: 1,
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
  boxRefused: { borderColor: c.danger },
  pressed: { opacity: 0.6 },
  value: { ...TYPE.input, flex: 1, minWidth: 0 },
  placeholder: { color: c.inkMuted },
  note: { ...TYPE.small, color: c.inkMuted },
  group: { gap: 8 },
  groupTitle: { ...TYPE.label, color: c.inkMuted },
  list: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  tick: { width: 18 },
  optionLabel: { flex: 1, fontSize: 16, lineHeight: 22 },
  optionChosen: { fontWeight: '700' },
}));
