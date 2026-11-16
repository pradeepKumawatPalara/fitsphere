import { inViewWhenFocused } from '../navigation/inViewRoute';
import { InsightScreen } from '../screens/InsightScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(InsightScreen);
