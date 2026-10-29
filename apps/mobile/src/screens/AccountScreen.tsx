import { useRouter } from 'expo-router';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ApiStatus } from '../components/ApiStatus';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { LocalDatabaseCheck } from '../components/LocalDatabaseCheck';
import { TodayIst } from '../components/TodayIst';
import { useSync } from '../sync/SyncProvider';
import { LogOut } from './LogOut';

// Account, opened from the header's avatar (REQ-NAV-002). In this slice: the email, the user's
// targets (REQ-ROLE-007), Log out (REQ-ACC-008), and in development builds the tools the
// Skeleton's phone checks use (SC-02, SC-04, SC-08, SC-13). The Settings slice adds the settings
// (MVP default, D-23).
export function AccountScreen({ showDevTools = __DEV__ }: { showDevTools?: boolean }) {
  const { deps, email } = useAuth();
  const sync = useSync();
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text>Signed in as {email}</Text>
      <Button title="Your targets" onPress={() => router.push('/targets')} />
      <LogOut />
      {showDevTools ? (
        <View style={styles.dev}>
          <Text accessibilityRole="header" style={styles.heading}>
            Development
          </Text>
          <TodayIst />
          <Text>Sync: {sync.status}</Text>
          <ApiStatus apiUrl={deps.apiUrl} check={checkApiHealth} />
          <LocalDatabaseCheck />
          <Button title="200-row list (development)" onPress={() => router.push('/dev-history')} />
          <ExpiredTokenTest deps={deps} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  heading: { fontSize: 17, fontWeight: '600' },
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 16 },
});
