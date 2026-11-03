import type { AccountState } from '../auth/service';
import { TEXTS } from '../auth/texts';

/**
 * Back to Sign in: back, when Sign in opened this screen (Sign up, Forgot password, and Check email
 * after Sign up), so there is never a second Sign in under it; Sign in itself when nothing did,
 * e.g. a screen opened from a link in an email.
 */
export function backToSignIn(router: { canGoBack(): boolean; back(): void; replace(href: '/sign-in'): void }) {
  if (router.canGoBack()) router.back();
  else router.replace('/sign-in');
}

/** Where to go once the account check is done; returns a text to show when staying put. */
type Navigator = { replace(href: '/home' | '/account-setup' | '/sign-in'): void };

export function goAfterAccountCheck(router: Navigator, state: AccountState, step: string): string | null {
  switch (state.kind) {
    case 'ready':
      router.replace('/home');
      return null;
    case 'needsAgeConfirmation':
      router.replace('/account-setup');
      return null;
    case 'signedOut':
      router.replace('/sign-in');
      return null;
    case 'emailNotVerified':
      return TEXTS.emailNotVerified;
    case 'offline':
      return TEXTS.needsInternet(step);
    case 'unavailable':
      return TEXTS.tryLater;
  }
}
