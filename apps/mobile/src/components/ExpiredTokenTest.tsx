import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Button, View } from 'react-native';
import { callApi } from '../api/client';
import type { AuthDeps } from '../auth/service';
import { Text } from './ui';

// Development builds only (ADR-0004 step 3): keeps a copy of the current access token inside the
// app and, more than an hour later, sends it to /v1/me, which must answer 401. The token never
// leaves the phone except to the API, and is never shown.
const KEY = 'dev-expired-token-test';

export function ExpiredTokenTest({ deps }: { deps: AuthDeps }) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((value) => setSavedAt(value ? (JSON.parse(value) as { savedAt: number }).savedAt : null))
      .catch(() => setSavedAt(null));
  }, []);

  async function save() {
    const session = (await deps.client.getSession()).data.session;
    if (!session) return;
    const now = Date.now();
    await SecureStore.setItemAsync(KEY, JSON.stringify({ token: session.access_token, savedAt: now }));
    setSavedAt(now);
    setResult(null);
  }

  async function send() {
    const value = await SecureStore.getItemAsync(KEY);
    if (!value) return;
    const { token, savedAt: at } = JSON.parse(value) as { token: string; savedAt: number };
    const minutes = Math.floor((Date.now() - at) / 60_000);
    const response = await callApi(deps.apiUrl, '/me', { token });
    const answer = response.kind === 'offline' ? 'no answer (offline)' : `HTTP ${response.status}`;
    setResult(`Token saved ${minutes} min ago: ${answer}`);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text>Expired-token test (development only)</Text>
      <Text>
        {savedAt
          ? `Saved at ${clock(savedAt)}; send after ${clock(savedAt + 61 * 60_000)}.`
          : 'No token saved.'}
      </Text>
      <Button title="Save current token" onPress={() => void save()} />
      <Button title="Send saved token" disabled={savedAt === null} onPress={() => void send()} />
      {result ? <Text>{result}</Text> : null}
    </View>
  );
}

function clock(time: number): string {
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
