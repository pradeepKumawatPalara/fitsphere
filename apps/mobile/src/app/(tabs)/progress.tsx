// Progress (REQ-PRG-001…006; D-30). The weight history it showed until slice 5 is now "All
// weigh-ins" (app/weight-history.tsx).
import { inViewWhenFocused } from '../../navigation/inViewRoute';
import { ProgressScreen } from '../../screens/ProgressScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(ProgressScreen);
