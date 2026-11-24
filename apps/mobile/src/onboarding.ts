import { TARGET_RANGES, type TargetKind } from '@fitsphere/shared';
import { parseOneDecimal } from './format';

// First sign-in onboarding (D-124, REQ-ACC-013, docs/plans/onboarding.md): the pure rules, so they are
// tested without screens. Which steps apply, the common starting targets, the resume step and the
// weight stepper.

export type OnboardingStep = 'welcome' | 'about' | 'weight' | 'health' | 'done';

/** The steps with a number and a Skip, in order; Health Connect only where the phone has it. */
export function numberedSteps(healthConnectAvailable: boolean): ('about' | 'weight' | 'health')[] {
  return healthConnectAvailable ? ['about', 'weight', 'health'] : ['about', 'weight'];
}

/** The whole flow, Welcome first and All set last. */
export function flowSteps(healthConnectAvailable: boolean): OnboardingStep[] {
  return ['welcome', ...numberedSteps(healthConnectAvailable), 'done'];
}

/** The step to open: the one left at, if it still applies, else Welcome. */
export function resumeStep(saved: string | null, healthConnectAvailable: boolean): OnboardingStep {
  const steps = flowSteps(healthConnectAvailable);
  return steps.find((step) => step === saved) ?? 'welcome';
}

/** "1 of 3" for a numbered step; null for Welcome and All set. */
export function stepCounter(step: OnboardingStep, healthConnectAvailable: boolean): { at: number; of: number } | null {
  const numbered = numberedSteps(healthConnectAvailable);
  const index = numbered.findIndex((item) => item === step);
  return index < 0 ? null : { at: index + 1, of: numbered.length };
}

/** The step after or before `step`, or null at the ends. */
export function neighbour(step: OnboardingStep, healthConnectAvailable: boolean, direction: 1 | -1): OnboardingStep | null {
  const steps = flowSteps(healthConnectAvailable);
  return steps[steps.indexOf(step) + direction] ?? null;
}

/**
 * The common starting targets saved at Go to Home (the owner's plan, 2026-11-24): the numbers of the old
 * first-time forms, each inside the approved ranges. No target body weight: that is the user's own aim.
 */
export const STARTING_TARGETS: Partial<Record<TargetKind, number>> = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  fibre: 30,
  steps: 8000,
  weekly_workouts: 4,
};

/** The starting targets for each kind the user has not already set. */
export function startingTargetsToSave(alreadySet: readonly TargetKind[]): { kind: TargetKind; value: number }[] {
  return (Object.entries(STARTING_TARGETS) as [TargetKind, number][])
    .filter(([kind, value]) => !alreadySet.includes(kind) && value >= TARGET_RANGES[kind].min && value <= TARGET_RANGES[kind].max)
    .map(([kind, value]) => ({ kind, value }));
}

/** The starting weight shown first, in kg (the design's 72.4); the user's unit shows it converted. */
export const DEFAULT_START_KG = 72.4;

/** The weight text moved by 0.1 up or down, one decimal; unchanged when it is not a number. */
export function nudgeWeightText(text: string, direction: 1 | -1): string {
  const value = parseOneDecimal(text);
  if (value === null) return text;
  return Math.max(0, Math.round(value * 10 + direction) / 10).toFixed(1);
}
