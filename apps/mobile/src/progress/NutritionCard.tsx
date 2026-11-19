import type { IstDay } from '@fitsphere/shared';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text, TextButton } from '../components/ui';
import { formatInteger } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { averageCalories, daysLogged, type DayNutrition } from './calculations';
import { daysLoggedText, PROGRESS_TEXTS } from './texts';

type Props = {
  nutrition: Readonly<Record<IstDay, DayNutrition>>;
  today: IstDay;
  accountStart: IstDay | null;
  /** The user's own daily calorie target (D-20), or null when none is set. */
  calorieTarget: number | null;
  onSetTarget(): void;
};

const SIZE = 92;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring filled `share` (0 to 1) clockwise from the top, with `text` in the middle. */
function Ring({ share, color, text, label }: { share: number; color: string; text: string; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const filled = Math.max(0, Math.min(1, share)) * CIRCUMFERENCE;
  return (
    <View accessible accessibilityLabel={label} style={styles.ring}>
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.track} strokeWidth={STROKE} fill="none" />
        {filled > 0 ? (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
            fill="none"
          />
        ) : null}
      </Svg>
      <View style={styles.ringText} pointerEvents="none">
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.ringFigure}>
          {text}
        </Text>
      </View>
    </View>
  );
}

// The last 4 weeks of eating as two tiles side by side (the owner's B, 2026-11-18): average daily
// calories against the user's own target (REQ-PRG-002) and "Meals logged: X of Y days" (REQ-PRG-003,
// Q-044), each a ring. The sums are unchanged.
export function NutritionCard({ nutrition, today, accountStart, calorieTarget, onSetTarget }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const average = averageCalories(nutrition, today);
  const logged = daysLogged(nutrition, today, accountStart);
  const caloriesLabel =
    average === null
      ? PROGRESS_TEXTS.noMeals
      : `Average ${formatInteger(average)} kcal a day${calorieTarget === null ? '' : `, target ${formatInteger(calorieTarget)}`}`;
  return (
    <View style={styles.row}>
      <View style={styles.tile}>
        <Text accessibilityRole="header" style={styles.title}>
          Avg calories
        </Text>
        <Ring
          share={average === null || calorieTarget === null || calorieTarget === 0 ? 0 : average / calorieTarget}
          color={colors.accent}
          text={average === null ? '–' : formatInteger(average)}
          label={caloriesLabel}
        />
        {calorieTarget === null ? (
          <>
            <Text style={styles.caption}>{PROGRESS_TEXTS.noCalorieTarget}</Text>
            <TextButton title="Set a target" outlined onPress={onSetTarget} />
          </>
        ) : (
          <Text style={styles.caption}>{`kcal a day · target ${formatInteger(calorieTarget)}`}</Text>
        )}
      </View>
      <View style={styles.tile}>
        <Text accessibilityRole="header" style={styles.title}>
          Meals logged
        </Text>
        <Ring
          share={logged.total === 0 ? 0 : logged.logged / logged.total}
          color={colors.success}
          text={`${logged.logged}/${logged.total}`}
          label={daysLoggedText(logged)}
        />
        <Text style={styles.caption}>days in the last 4 weeks</Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minWidth: 0, padding: 12, borderRadius: 4, gap: 6, alignItems: 'center', backgroundColor: c.surface },
  title: { ...TYPE.label, alignSelf: 'flex-start', color: c.inkMuted },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', left: STROKE + 4, right: STROKE + 4, alignItems: 'center' },
  ringFigure: { ...TYPE.metric, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'], color: c.ink },
  caption: { fontSize: 12, lineHeight: 16, textAlign: 'center', color: c.inkMuted },
}));
