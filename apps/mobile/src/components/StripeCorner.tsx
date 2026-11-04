import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Polygon } from 'react-native-svg';
import { useTheme } from '../theme';

// The design's signature corner (D-35): diagonal caramel stripes, 4 wide with a gap of 10, in a
// triangle at the top right (200 square, or `size` where less room is left, as in the header),
// behind everything. Decoration only: screen readers and touches pass through it.

// The stripes run at 135°: lines 14 apart across them are 14·√2 apart along the top edge.
const STEP = 14 * Math.SQRT2;

export function StripeCorner({ size = 200 }: { size?: number }) {
  const { colors } = useTheme();
  const starts = Array.from({ length: Math.ceil((2 * size) / STEP) + 1 }, (_, i) => i * STEP);
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ position: 'absolute', top: 0, right: 0 }}
    >
      <Svg width={size} height={size}>
        <Defs>
          {/* polygon(40% 0, 100% 0, 100% 60%) */}
          <ClipPath id="stripe-corner">
            <Polygon points={`${size * 0.4},0 ${size},0 ${size},${size * 0.6}`} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#stripe-corner)">
          {starts.map((x) => (
            <Line key={x} x1={x} y1={0} x2={x - size} y2={size} stroke={colors.stripe} strokeWidth={4} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
