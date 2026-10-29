// Texts the app shows for sign-in (error model, "Texts the app shows"). They come from the app,
// never from Supabase, so they cannot reveal whether an address is registered (REQ-ACC-010, D-11).
export const TEXTS = {
  signUpSent:
    "Check your email. If this address can be used for a new account, we've sent a link to finish signing up.",
  resetSent: "If an account uses this address, we've sent a link to reset the password.",
  signInFailed: 'Email or password is incorrect.',
  ageConfirmation: 'I am 18 or older',
  needsInternet: (step: string) => `${step} needs an internet connection.`,
  // MVP default (D-18): Supabase or the API cannot answer right now.
  tryLater: 'Something went wrong. Try again later.',
  emailNotVerified: 'Verify your email first. Check your inbox for the link.',
  passwordRule: 'Use at least 8 characters.',
  emailRule: 'Enter your email address.',
} as const;

// Decision 3 of the Skeleton plan: at least 8 characters, no character rules. Supabase accepts
// at most 72 bytes; the app keeps to 72 characters.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function passwordProblem(password: string): string | null {
  return password.length < PASSWORD_MIN || password.length > PASSWORD_MAX ? TEXTS.passwordRule : null;
}

export function emailProblem(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : TEXTS.emailRule;
}
