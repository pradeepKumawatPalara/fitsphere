// The weight history (REQ-PRG-001; ADR-0007 rule 1), opened by "All weigh-ins" on Progress (D-30).
import { inViewWhenFocused } from '../navigation/inViewRoute';
import { HistoryScreen } from '../screens/HistoryScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(HistoryScreen);
