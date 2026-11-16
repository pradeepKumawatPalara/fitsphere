import { inViewWhenFocused } from '../navigation/inViewRoute';
import { AccountScreen } from '../screens/AccountScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(AccountScreen);
