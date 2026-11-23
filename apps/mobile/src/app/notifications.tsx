import { inViewWhenFocused } from '../navigation/inViewRoute';
import { NotificationsScreen } from '../screens/NotificationsScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(NotificationsScreen);
