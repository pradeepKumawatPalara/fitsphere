// Texts the app shows for sign-in (error model, "Texts the app shows"). They come from the app,
// never from Supabase, so they cannot reveal whether an address is registered (REQ-ACC-010, D-11).
export const TEXTS = {
  // After sign-up, as a heading and its text (the redesign's 1.3, D-35).
  signUpSentHeading: 'Check your email',
  signUpSent: "If this address can be used for a new account, we've sent a link to finish signing up.",
  resetSent: "If an account uses this address, we've sent a link to reset the password.",
  signInFailed: 'Email or password is incorrect.',
  ageConfirmation: 'I am 18 or older',
  needsInternet: (step: string) => `${step} needs an internet connection.`,
  // MVP default (D-18): Supabase or the API cannot answer right now.
  tryLater: 'Something went wrong. Try again later.',
  emailNotVerified: 'Verify your email first. Check your inbox for the link.',
  // The limits are PASSWORD_MIN and PASSWORD_MAX below.
  passwordRule: 'Use 8 to 72 characters.',
  passwordRequired: 'Enter your password.',
  emailRule: 'Enter your email address.',
  emailFormat: 'Enter an email address like name@example.com.',
  // D-100: an address is at most 254 characters.
  emailLong: 'Email can be up to 254 characters.',
  // Under Sign up and Continue until the 18+ box is ticked (REQ-ACC-010, D-18).
  ageHint: 'Tick "I am 18 or older" to continue.',
  // MVP defaults (D-18) for "Set a new password".
  resetLinkInvalid:
    'This link has expired, was already used, or was opened on another phone. Request a new one on this phone.',
  samePassword: 'Use a different password from your current one.',
  // MVP defaults (D-31) for Settings.
  currentPasswordRequired: 'Enter your current password.',
  wrongCurrentPassword: 'Your current password is incorrect.',
  passwordChanged: "Your password has been changed. You've been signed out on your other devices.",
  accountDeleted: 'Your account has been deleted.',
  deleteFailed: "Your account couldn't be deleted right now. Try again later.",
} as const;

// Decision 3 of the Skeleton plan: at least 8 characters, no character rules. Supabase accepts
// at most 72 bytes; the app keeps to 72 characters.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
/** The longest email address (D-100). */
export const EMAIL_MAX = 254;

export function passwordProblem(password: string): string | null {
  return password.length < PASSWORD_MIN || password.length > PASSWORD_MAX ? TEXTS.passwordRule : null;
}

/** Nothing typed asks for the address; something that isn't one shows what one looks like. */
export function emailProblem(email: string): string | null {
  if (email.trim() === '') return TEXTS.emailRule;
  if (email.trim().length > EMAIL_MAX) return TEXTS.emailLong;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : TEXTS.emailFormat;
}
