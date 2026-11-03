import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// The wordmark (D-35): "FIT" in ink and "SPHERE" in caramel. Text only; there is no logo yet.
export function Wordmark() {
  const styles = useStyles();
  return (
    <Text accessibilityLabel="FitSphere" style={styles.word}>
      Fit<Text style={styles.sphere}>sphere</Text>
    </Text>
  );
}

const useStyles = themedStyles((c) => ({
  word: TYPE.wordmark,
  sphere: { color: c.accent },
}));
