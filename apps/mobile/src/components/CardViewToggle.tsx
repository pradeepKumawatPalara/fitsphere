import { Apple, Dumbbell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { HomeCardView } from '../homeCardView';
import { themedStyles, useTheme } from '../theme';

type Props = {
  view: HomeCardView;
  onChange: (view: HomeCardView) => void;
};

// The two-icon toggle at the left of Home's first card (D-123): the food icon for Calories, the dumbbell
// for Workout. The chosen one is filled in caramel. Screen readers hear a group named "Show" with two buttons.
export function CardViewToggle({ view, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const options = [
    { value: 'calories', label: 'Calories eaten', Icon: Apple },
    { value: 'workout', label: 'Workouts', Icon: Dumbbell },
  ] as const;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Show" style={styles.track}>
      {options.map(({ value, label, Icon }) => {
        const selected = view === value;
        return (
          <Pressable
            key={value}
            testID={`card-view-${value}`}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onChange(value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Icon size={16} strokeWidth={2.25} color={selected ? colors.onPrimary : colors.inkMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  track: { flexDirection: 'row', padding: 2, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSunken },
  option: { width: 34, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: c.primary },
}));
