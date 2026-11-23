import { Tabs, useRouter } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HeaderActions, HeaderTitle } from '../../components/AppHeader';
import { StripeCorner } from '../../components/StripeCorner';
import { TabBar } from '../../components/TabBar';
import { WorkoutInProgress } from '../../components/WorkoutInProgress';
import { InViewWhenFocused } from '../../navigation/inViewRoute';
import { SelectedDayProvider } from '../../navigation/SelectedDayProvider';
import { useOnboardingGate } from '../../onboardingGate';
import { useTheme } from '../../theme';

/** The header's height below the status bar: the date over the greeting, with room around them. */
const HEADER = 72;
/** The tab bar's height above the phone's navigation bar (TabBar). */
const TAB_BAR = 64;

// The Personal Training User's main screens (REQ-NAV-001): four tabs under the common header
// (REQ-NAV-002), sharing the selected date. The redesign's 2.1 (locked by the owner, 2026-11-03):
// the app's own tab bar (TabBar), and a header with the stripe corner at its top right, the whole
// triangle within the header. Theme tokens only. While a workout's timer runs or is paused, its pill
// floats above the tab bar at the right (D-83).
export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  // A new user with no target is sent to "Set your targets" once, after the first sync.
  useOnboardingGate();
  // None outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const top = insets?.top ?? 0;
  const height = HEADER + top;
  return (
    <SelectedDayProvider>
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            // Each tab has its own header; only the shown tab's reads the phone's data (REQ-NFR-003).
            headerTitle: () => (
              <InViewWhenFocused>
                <HeaderTitle />
              </InViewWhenFocused>
            ),
            headerRight: () => (
              <InViewWhenFocused>
                <HeaderActions />
              </InViewWhenFocused>
            ),
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
        {/* Under a page pushed over the tabs, the pill is out of view: it reads and counts nothing. */}
        <InViewWhenFocused>
          <WorkoutInProgress top={height + 8} bottom={TAB_BAR + (insets?.bottom ?? 0) + 12} onOpen={(id) => router.push(`/workout/${id}`)} />
        </InViewWhenFocused>
      </View>
    </SelectedDayProvider>
  );
}
