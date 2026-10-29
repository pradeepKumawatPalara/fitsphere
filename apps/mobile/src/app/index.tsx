import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export default function Start() {
  const { signedIn } = useAuth();
  if (signedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={signedIn ? '/home' : '/sign-in'} />;
}
