import { inViewWhenFocused } from '../navigation/inViewRoute';
import { TargetsScreen } from '../screens/TargetsScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(TargetsScreen);
