import { inViewWhenFocused } from '../../navigation/inViewRoute';
import { HomeScreen } from '../../screens/HomeScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(HomeScreen);
