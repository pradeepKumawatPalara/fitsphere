import { inViewWhenFocused } from '../../navigation/inViewRoute';
import { WorkoutScreen } from '../../screens/WorkoutScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(WorkoutScreen);
