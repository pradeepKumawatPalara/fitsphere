import { createContext, useContext } from 'react';

/**
 * Whether the screen this part of the app is drawn on is in view: its tab shown, with no page pushed
 * over it. A screen out of view reads nothing from the phone after a save or sync; it reads once when
 * it comes back into view (`useDataVersion`). Outside a route (the providers, tests), in view.
 */
export const ScreenInViewContext = createContext(true);

export function useScreenInView(): boolean {
  return useContext(ScreenInViewContext);
}
