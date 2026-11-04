import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Polygon } from 'react-native-svg';
import { useTheme } from '../theme';

// The hero card's cut corner (D-35): its top right corner cut off at 45°, 32 across. Drawn over the
// card, in the screen's colour with caramel stripes, so the card stays a plain view.

const SIZE = 32;
// Stripes 3 wide and 8 apart across them, at 135°.
const STEP = 8 * Math.SQRT2;
const STARTS = Array.from({ length: Math.ceil((2 * SIZE) / STEP) + 1 }, (_, i) => i * STEP);
const TRIANGLE = `0,0 ${SIZE},0 ${SIZE},${SIZE}`;

export function CutCorner() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ position: 'absolute', top: 0, right: 0 }}
    >
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <ClipPath id="cut-corner">
            <Polygon points={TRIANGLE} />
          </ClipPath>
        </Defs>
        <Polygon points={TRIANGLE} fill={colors.bg} />
        <G clipPath="url(#cut-corner)">
          {STARTS.map((x) => (
            <Line key={x} x1={x} y1={0} x2={x - SIZE} y2={SIZE} stroke={colors.accent} strokeOpacity={0.3} strokeWidth={3} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
