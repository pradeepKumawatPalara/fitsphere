import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// The wordmark (D-35): "FIT" in ink and "SPHERE" in caramel. Text only; there is no logo yet.
// `large` while the app opens (1.8).
export function Wordmark({ large = false }: { large?: boolean }) {
  const styles = useStyles();
  return (
    <Text accessibilityLabel="FitSphere" style={[styles.word, large && styles.large]}>
      Fit<Text style={styles.sphere}>sphere</Text>
    </Text>
  );
}

const useStyles = themedStyles((c) => ({
  word: TYPE.wordmark,
  large: { fontSize: 32, lineHeight: 36, letterSpacing: 5 },
  sphere: { color: c.accent },
}));
