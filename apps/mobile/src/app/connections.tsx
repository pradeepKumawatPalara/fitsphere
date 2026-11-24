import { inViewWhenFocused } from '../navigation/inViewRoute';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(ConnectionsScreen);
