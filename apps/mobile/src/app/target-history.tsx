import { inViewWhenFocused } from '../navigation/inViewRoute';
import { TargetHistoryScreen } from '../screens/TargetHistoryScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(TargetHistoryScreen);
