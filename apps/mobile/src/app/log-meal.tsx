import { inViewWhenFocused } from '../navigation/inViewRoute';
import { LogMealScreen } from '../screens/LogMealScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(LogMealScreen);
