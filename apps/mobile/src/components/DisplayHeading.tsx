import type { StyleProp, TextStyle } from 'react-native';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// A sign-in screen's heading in the design's display style (D-35): capitals over two lines, the
// last word on the second line in caramel ("SIGN" over "IN"). Screen readers hear it as one heading.
export function DisplayHeading({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const styles = useStyles();
  const split = text.lastIndexOf(' ');
  return (
    <Text accessibilityRole="header" accessibilityLabel={text} style={[styles.heading, style]}>
      {text.slice(0, split)}
      {'\n'}
      <Text style={styles.second}>{text.slice(split + 1)}</Text>
    </Text>
  );
}

const useStyles = themedStyles((c) => ({
  heading: TYPE.display,
  second: { color: c.accent },
}));
