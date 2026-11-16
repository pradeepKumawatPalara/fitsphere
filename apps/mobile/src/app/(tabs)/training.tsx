import { inViewWhenFocused } from '../../navigation/inViewRoute';
import { TrainingScreen } from '../../screens/TrainingScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(TrainingScreen);
