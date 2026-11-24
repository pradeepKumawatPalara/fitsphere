import { inViewWhenFocused } from '../navigation/inViewRoute';
import { OnboardingScreen } from '../screens/OnboardingScreen';

// First sign-in onboarding (D-124): shown once, until the account has finished it.
export default inViewWhenFocused(OnboardingScreen);
