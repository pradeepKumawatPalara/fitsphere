import { inViewWhenFocused } from '../navigation/inViewRoute';
import { SavedMealScreen } from '../screens/SavedMealScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(SavedMealScreen);
