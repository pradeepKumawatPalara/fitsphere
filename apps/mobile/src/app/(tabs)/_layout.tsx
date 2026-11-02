import { Tabs } from 'expo-router';
import { HeaderActions, HeaderTitle } from '../../components/AppHeader';
import { SelectedDayProvider } from '../../navigation/SelectedDayProvider';

// The Personal Training User's main screens (REQ-NAV-001): four tabs under the common header
// (REQ-NAV-002), sharing the selected date. Text labels only (D-23).
export default function TabsLayout() {
  return (
    <SelectedDayProvider>
      <Tabs
        screenOptions={{
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <HeaderActions />,
          // A flat edge, as the pushed screens' header.
          headerShadowVisible: false,
          tabBarIcon: () => null,
          tabBarIconStyle: { display: 'none' },
          tabBarLabelStyle: { fontSize: 15 },
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
