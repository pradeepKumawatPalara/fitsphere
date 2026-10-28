import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { ApiHealth } from '../api/health';

type Status = 'checking' | ApiHealth;

const LABELS: Record<Status, string> = {
  checking: 'API: checking…',
  ok: 'API: ok',
  unreachable: 'API: unreachable',
};

type Props = {
  apiUrl: string | undefined;
  check: (apiUrl: string) => Promise<ApiHealth>;
};

export function ApiStatus({ apiUrl, check }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!apiUrl) return;
    let current = true;
    void check(apiUrl).then((result) => {
      if (current) setStatus(result);
    });
    return () => {
      current = false;
    };
  }, [apiUrl, check, attempt]);

  if (!apiUrl) {
    return <Text>API address not set: add EXPO_PUBLIC_API_URL to apps/mobile/.env</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{LABELS[status]}</Text>
      <Text style={styles.address}>{apiUrl}</Text>
      <Button
        title="Check again"
        disabled={status === 'checking'}
        onPress={() => {
          setStatus('checking');
          setAttempt((n) => n + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  status: { fontSize: 20, fontWeight: '600' },
  address: { color: '#555' },
});
