import { inViewWhenFocused } from '../navigation/inViewRoute';
import { HealthGuideScreen } from '../screens/HealthGuideScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(HealthGuideScreen);
