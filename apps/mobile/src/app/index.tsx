import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme';

export default function Start() {
  const { signedIn } = useAuth();
  const { colors } = useTheme();
  if (signedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Redirect href={signedIn ? '/home' : '/sign-in'} />;
}
