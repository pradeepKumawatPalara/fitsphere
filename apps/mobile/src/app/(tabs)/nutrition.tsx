import { inViewWhenFocused } from '../../navigation/inViewRoute';
import { NutritionScreen } from '../../screens/NutritionScreen';

// Reads the phone's data only while in view (REQ-NFR-003).
export default inViewWhenFocused(NutritionScreen);
