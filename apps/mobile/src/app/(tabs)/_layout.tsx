import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useContext, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HeaderActions, HeaderTitle } from '../../components/AppHeader';
import { Text } from '../../components/ui';
import { SelectedDayProvider } from '../../navigation/SelectedDayProvider';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Each tab's icon: filled while it is the tab shown, outlined otherwise (D-34, amending D-23). */
const TAB_ICONS: Record<string, { active: IconName; idle: IconName }> = {
  home: { active: 'home', idle: 'home-outline' },
  nutrition: { active: 'nutrition', idle: 'nutrition-outline' },
  training: { active: 'barbell', idle: 'barbell-outline' },
  progress: { active: 'stats-chart', idle: 'stats-chart-outline' },
};

// The Personal Training User's main screens (REQ-NAV-001): four tabs under the common header
// (REQ-NAV-002), sharing the selected date. Each tab is an icon over its label (D-34, amending
// D-23): the tab shown has its filled icon on a tinted pill and its label in blue, the others an
// outlined icon and a muted label. Theme tokens only.
export default function TabsLayout() {
  const { colors } = useTheme();
  // None outside the app (tests).
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <SelectedDayProvider>
      <Tabs
        screenOptions={({ route }) => ({
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <HeaderActions />,
          // A flat edge, as the pushed screens' header.
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          // 64 for the pill and the label, above the phone's navigation bar.
          tabBarStyle: { height: 64 + bottom, paddingTop: 6, backgroundColor: colors.background, borderTopColor: colors.border },
          tabBarIconStyle: styles.iconSlot,
          tabBarIcon: ({ focused }) => {
            const icon = TAB_ICONS[route.name];
            return (
              <View testID={`tab-icon-${route.name}`} style={[styles.pill, focused && { backgroundColor: colors.surfaceSelected }]}>
                {icon ? (
                  <Ionicons name={focused ? icon.active : icon.idle} size={22} color={focused ? colors.primary : colors.textMuted} />
                ) : null}
              </View>
            );
          },
          tabBarLabel: ({ focused, color, children }) => (
            <Text style={[styles.label, { color }, focused && styles.labelActive]}>{children}</Text>
          ),
        })}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="nutrition" options={{ title: 'Nutrition' }} />
        <Tabs.Screen name="training" options={{ title: 'Training' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      </Tabs>
    </SelectedDayProvider>
  );
}

// The pill 56 by 32, radius 16; labels 13, the small-print size, so they fit under the icons.
const styles = StyleSheet.create({
  iconSlot: { width: 56, height: 32 },
  pill: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 4, fontSize: 13 },
  labelActive: { fontWeight: '600' },
});
