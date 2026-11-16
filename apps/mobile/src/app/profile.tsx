import { inViewWhenFocused } from '../navigation/inViewRoute';
import { ProfileScreen } from '../screens/ProfileScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(ProfileScreen);
