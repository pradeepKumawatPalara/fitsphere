import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Polygon } from 'react-native-svg';
import { useTheme } from '../theme';

// The design's signature corner (D-35): diagonal caramel stripes, 4 wide with a gap of 10, in a
// 200-square triangle at the screen's top right, behind everything. Decoration only: screen readers
// and touches pass through it.

const SIZE = 200;
// The stripes run at 135°: lines 14 apart across them are 14·√2 apart along the top edge.
const STEP = 14 * Math.SQRT2;
const STARTS = Array.from({ length: Math.ceil((2 * SIZE) / STEP) + 1 }, (_, i) => i * STEP);

export function StripeCorner() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: 'absolute', top: 0, right: 0 }}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          {/* polygon(40% 0, 100% 0, 100% 60%) */}
          <ClipPath id="stripe-corner">
            <Polygon points={`${SIZE * 0.4},0 ${SIZE},0 ${SIZE},${SIZE * 0.6}`} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#stripe-corner)">
          {STARTS.map((x) => (
            <Line key={x} x1={x} y1={0} x2={x - SIZE} y2={SIZE} stroke={colors.stripe} strokeWidth={4} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
