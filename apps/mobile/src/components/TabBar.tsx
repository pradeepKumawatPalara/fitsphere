import type { BottomTabBarProps } from 'expo-router/tabs';
import { Apple, ChartColumn, Dumbbell, House, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

/** Each tab's icon (D-34, amending D-23), from Lucide (D-35): outlines only. */
const TAB_ICONS: Record<string, LucideIcon> = {
  home: House,
  nutrition: Apple,
  training: Dumbbell,
  progress: ChartColumn,
};

// The tab bar (REQ-NAV-001; the redesign's 2.1, locked by the owner 2026-11-03, in place of D-34
// answer 9's tinted pill): an icon over each label in condensed capitals; the tab shown in caramel
// with a bar along its top edge, the others muted. Sunken in the dark theme, a card in the light;
// 64 tall above the phone's navigation bar. Each tab keeps its name and selected state for screen
// readers, and a press reaches the navigator as the standard tab bar's does.
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useStyles();
  const { scheme, colors } = useTheme();
  return (
    <View
      role="tablist"
      style={[styles.bar, { paddingBottom: insets.bottom }, scheme === 'dark' ? styles.sunken : styles.raised]}
    >
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const Icon = TAB_ICONS[route.name];
        const color = focused ? colors.accent : colors.inkMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View testID={`tab-marker-${route.name}`} style={[styles.marker, focused && styles.markerShown]} />
            {Icon ? <Icon size={24} color={color} /> : null}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The marker sits over the bar's top edge, across the middle 44 % of the tab.
const useStyles = themedStyles((c) => ({
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border },
  sunken: { backgroundColor: c.surfaceSunken },
  raised: { backgroundColor: c.surface },
  tab: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  marker: { position: 'absolute', top: -1, left: '28%', width: '44%', height: 3 },
  markerShown: { backgroundColor: c.accent },
  label: TYPE.tab,
  pressed: { opacity: 0.6 },
}));
