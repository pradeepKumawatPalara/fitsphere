import { useState } from 'react';
import { Button, View } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { runRowCheck } from '../local/rowCheck';
import { Text } from './ui';

// Development builds only: the start-up check's result (ADR-0007 step 6) and the 1,000-row check
// (ADR-0001 step 4). Run the row check in airplane mode, without reloading the app.
export function LocalDatabaseCheck() {
  const { state } = useLocalDatabase();
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (state.status !== 'ready') return;
    setResult('Running…');
    try {
      const check = await runRowCheck(state.db);
      setResult(
        `Wrote ${check.written} rows in ${check.writeMs.toFixed(0)} ms; read ${check.read} in ${check.readMs.toFixed(0)} ms`,
      );
    } catch {
      setResult('The row check failed.');
    }
  }

  const status =
    state.status === 'ready'
      ? `Encrypted database: SQLCipher ${state.cipherVersion}`
      : state.status === 'failed'
        ? 'Encrypted database: failed'
        : `Encrypted database: ${state.status}`;

  return (
    <View style={{ gap: 8 }}>
      <Text>{status}</Text>
      <Button title="Run 1,000-row check" disabled={state.status !== 'ready'} onPress={() => void run()} />
      {result ? <Text>{result}</Text> : null}
    </View>
  );
}
