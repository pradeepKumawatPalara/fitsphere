import { Tabs } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HeaderActions, HeaderTitle } from '../../components/AppHeader';
import { StripeCorner } from '../../components/StripeCorner';
import { TabBar } from '../../components/TabBar';
import { SelectedDayProvider } from '../../navigation/SelectedDayProvider';
import { useTheme } from '../../theme';

/** The header's height below the status bar: the date over the greeting, with room around them. */
const HEADER = 72;

// The Personal Training User's main screens (REQ-NAV-001): four tabs under the common header
// (REQ-NAV-002), sharing the selected date. The redesign's 2.1 (locked by the owner, 2026-11-03):
// the app's own tab bar (TabBar), and a header with the stripe corner at its top right, the whole
// triangle within the header. Theme tokens only.
export default function TabsLayout() {
  const { colors } = useTheme();
  // None outside the app (tests).
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const height = HEADER + top;
  return (
    <SelectedDayProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <HeaderActions />,
          // A flat edge, as the pushed screens' header.
          headerShadowVisible: false,
          headerStyle: { height },
          headerBackground: () => (
            <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.bg }}>
              <StripeCorner size={Math.min(200, height / 0.6)} />
            </View>
          ),
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="nutrition" options={{ title: 'Nutrition' }} />
        <Tabs.Screen name="training" options={{ title: 'Training' }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      </Tabs>
    </SelectedDayProvider>
  );
}
