import { inViewWhenFocused } from '../navigation/inViewRoute';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(NotificationSettingsScreen);
