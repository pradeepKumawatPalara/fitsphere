import { useIsFocused } from 'expo-router';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { ScreenInViewContext } from './screenInView';

/**
 * Tells what is inside whether its route is in view. The tabs keep every tab visited open, and a page
 * pushed over a screen leaves it open under it; neither is in view, so neither reads after a save or
 * sync until it is shown again (REQ-NFR-003: usable on a low-end Android phone).
 */
export function InViewWhenFocused({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return <ScreenInViewContext.Provider value={focused}>{children}</ScreenInViewContext.Provider>;
}

/** A route's screen, told whether it is in view (`InViewWhenFocused`). */
export function inViewWhenFocused<P extends object>(Screen: ComponentType<P>): (props: P) => ReactElement {
  function InViewRoute(props: P) {
    return (
      <InViewWhenFocused>
        <Screen {...props} />
      </InViewWhenFocused>
    );
  }
  InViewRoute.displayName = `InView(${Screen.displayName ?? Screen.name})`;
  return InViewRoute;
}
