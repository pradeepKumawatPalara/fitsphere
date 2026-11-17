import {
  ADDRESS_LINE1_MIN,
  ADDRESS_LINE_MAX,
  ADDRESS_PLACE_MAX,
  ADDRESS_PLACE_MIN,
  ADDRESS_PLACE_PATTERN,
  fromMillimetres,
  HEIGHT_MM_MAX,
  HEIGHT_MM_MIN,
  isAcceptedDateOfBirth,
  isIstDay,
  PHONE_PATTERN,
  PIN_CODE_PATTERN,
  PROFILE_AGE_MIN,
  PROFILE_NAME_MAX,
  PROFILE_NAME_MIN,
  PROFILE_NAME_PATTERN,
  toMillimetres,
  yearsBetween,
  type IstDay,
  type LengthUnit,
  type ProfileSetData,
  type Sex,
} from '@fitsphere/shared';
import { nameFromEmail, parseOneDecimal } from './format';

// The profile on the phone (REQ-ACC-011; docs/plans/user-profile.md): what the Profile screen shows
// and reads, and the name and initial the header and Settings use. Every field is optional; the
// server checks each again (profileSetDataSchema).

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

export const PROFILE_TEXTS = {
  // D-100: letters of any script, spaces, and . ' -.
  name: `Enter a name of ${PROFILE_NAME_MIN} to ${PROFILE_NAME_MAX} letters.`,
  line1: `Enter line 1 in ${ADDRESS_LINE1_MIN} to ${ADDRESS_LINE_MAX} characters.`,
  line2: `Enter line 2 in up to ${ADDRESS_LINE_MAX} characters.`,
  city: `Enter a city of ${ADDRESS_PLACE_MIN} to ${ADDRESS_PLACE_MAX} letters.`,
  // D-109: the state is chosen from the list; a state saved before it, not on the list, is kept.
  state: 'Choose your state from the list.',
  dateOfBirthAge: `Enter a date of birth for someone ${PROFILE_AGE_MIN} or older.`,
  dateOfBirthReal: 'Enter a real date of birth: day, month and year.',
  phone: 'Enter a 10-digit Indian mobile number.',
  pinCode: 'Enter a 6-digit PIN code.',
  addressIncomplete: 'Enter line 1, the city, the state and the PIN code, or leave the address empty.',
  stateNotListed: (state: string) => `"${state}" isn't on the list. Choose your state to change it.`,
  emailFixed: "Your sign-in email can't be changed yet.",
};

/**
 * India's 28 states and 8 union territories (D-109), as the address's State lists them, each group in
 * the order of the alphabet. Every name fits the address's rules (letters, spaces, at most 60).
 */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const UNION_TERRITORIES = [
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

const STATE_KEY = (text: string) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
const LISTED_STATES = new Map<string, string>([...INDIAN_STATES, ...UNION_TERRITORIES].map((state) => [STATE_KEY(state), state]));

/**
 * The list's name for a state typed before D-109, ignoring case, spaces and marks ("tamil nadu",
 * "Jammu & Kashmir"); null when it is not on the list.
 */
export function listedState(text: string): string | null {
  return LISTED_STATES.get(STATE_KEY(text)) ?? null;
}

/** The heights a profile takes in `unit`, one decimal: 100.0 to 250.0 cm, or 39.4 to 98.4 in. */
export function heightRange(unit: LengthUnit): { min: number; max: number } {
  const step = (value: number, by: number) => Math.round((value + by) * 10) / 10;
  const fits = (value: number) => {
    const mm = toMillimetres(value, unit);
    return mm >= HEIGHT_MM_MIN && mm <= HEIGHT_MM_MAX;
  };
  let min = fromMillimetres(HEIGHT_MM_MIN, unit);
  if (!fits(min)) min = step(min, 0.1);
  let max = fromMillimetres(HEIGHT_MM_MAX, unit);
  if (!fits(max)) max = step(max, -0.1);
  return { min, max };
}

export function heightProblem(unit: LengthUnit): string {
  const { min, max } = heightRange(unit);
  return unit === 'cm' ? `Enter a height from ${min} to ${max} cm.` : `Enter a height from ${min} to ${max} inches.`;
}

/** What the Profile screen holds while it is edited, as typed. */
export type ProfileForm = {
  name: string;
  day: string;
  month: string;
  year: string;
  sex: Sex | null;
  height: string;
  /** The 10 digits after +91, as typed. */
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pinCode: string;
};

export type ProfileField = 'name' | 'dateOfBirth' | 'height' | 'phone' | 'address';
export type ProfileProblems = Partial<Record<ProfileField, string>>;

/** The form for a saved profile, or an empty one; the height in `unit`. */
export function formFromProfile(profile: Omit<ProfileSetData, 'setAt'> | null, unit: LengthUnit): ProfileForm {
  const [year = '', month = '', day = ''] = profile?.dateOfBirth?.split('-') ?? [];
  const address = profile?.address ?? null;
  return {
    name: profile?.name ?? '',
    day,
    month,
    year,
    sex: profile?.sex ?? null,
    height: profile?.heightMm ? String(fromMillimetres(profile.heightMm, unit)) : '',
    phone: profile?.phone ? phoneDigits(profile.phone) : '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    // A state typed before D-109 shows with the list's spelling when it is on the list, else as saved.
    state: address ? (listedState(address.state) ?? address.state) : '',
    pinCode: address?.pinCode ?? '',
  };
}

/**
 * Reads the form on `today` (an IST day): the profile's fields, or the problem with each field that
 * has one. An empty field is left out (null); the photo is the screen's to add.
 */
export function readProfileForm(
  form: ProfileForm,
  today: IstDay,
  unit: LengthUnit,
): { kind: 'ok'; data: Omit<ProfileSetData, 'setAt' | 'photoMediaId'> } | { kind: 'problems'; problems: ProfileProblems } {
  const problems: ProfileProblems = {};

  const name = form.name.trim();
  if (name !== '' && (name.length < PROFILE_NAME_MIN || name.length > PROFILE_NAME_MAX || !PROFILE_NAME_PATTERN.test(name))) {
    problems.name = PROFILE_TEXTS.name;
  }

  let dateOfBirth: IstDay | null = null;
  if ([form.day, form.month, form.year].some((part) => part.trim() !== '')) {
    const date = typedDateOfBirth(form);
    if (!date || date > today) {
      problems.dateOfBirth = PROFILE_TEXTS.dateOfBirthReal;
    } else if (!isAcceptedDateOfBirth(date, today)) {
      problems.dateOfBirth = yearsBetween(date, today) < PROFILE_AGE_MIN ? PROFILE_TEXTS.dateOfBirthAge : PROFILE_TEXTS.dateOfBirthReal;
    } else {
      dateOfBirth = date;
    }
  }

  let heightMm: number | null = null;
  if (form.height.trim() !== '') {
    const value = parseOneDecimal(form.height.trim());
    const mm = value === null ? null : toMillimetres(value, unit);
    if (mm === null || mm < HEIGHT_MM_MIN || mm > HEIGHT_MM_MAX) problems.height = heightProblem(unit);
    else heightMm = mm;
  }

  let phone: string | null = null;
  if (form.phone.trim() !== '') {
    const digits = phoneDigits(form.phone);
    if (PHONE_PATTERN.test(`+91${digits}`)) phone = `+91${digits}`;
    else problems.phone = PROFILE_TEXTS.phone;
  }

  const line1 = form.line1.trim();
  const line2 = form.line2.trim();
  const city = form.city.trim();
  const state = form.state.trim();
  const pinCode = form.pinCode.trim();
  let address: ProfileSetData['address'] = null;
  if ([line1, line2, city, state, pinCode].some((part) => part !== '')) {
    const place = (text: string) => text.length >= ADDRESS_PLACE_MIN && text.length <= ADDRESS_PLACE_MAX && ADDRESS_PLACE_PATTERN.test(text);
    if (!line1 || !city || !state || !pinCode) problems.address = PROFILE_TEXTS.addressIncomplete;
    else if (line1.length < ADDRESS_LINE1_MIN || line1.length > ADDRESS_LINE_MAX) problems.address = PROFILE_TEXTS.line1;
    else if (line2.length > ADDRESS_LINE_MAX) problems.address = PROFILE_TEXTS.line2;
    else if (!place(city)) problems.address = PROFILE_TEXTS.city;
    else if (!place(state)) problems.address = PROFILE_TEXTS.state;
    else if (!PIN_CODE_PATTERN.test(pinCode)) problems.address = PROFILE_TEXTS.pinCode;
    else address = { line1, line2: line2 || null, city, state, pinCode };
  }

  if (Object.keys(problems).length > 0) return { kind: 'problems', problems };
  return {
    kind: 'ok',
    data: { name: name || null, dateOfBirth, sex: form.sex, heightMm, phone, address },
  };
}

/** The date the three boxes give, `YYYY-MM-DD`, when it is a real date; otherwise null. */
export function typedDateOfBirth(form: Pick<ProfileForm, 'day' | 'month' | 'year'>): IstDay | null {
  const [day, month, year] = [form.day, form.month, form.year].map((part) => part.trim()) as [string, string, string];
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isIstDay(date) ? date : null;
}

/**
 * The 10 digits of a mobile number as typed or stored: spaces and dashes dropped, and a leading +91,
 * 91 or 0 taken off a longer number.
 */
export function phoneDigits(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** "Age 32", from the date of birth on `today`. */
export function ageText(dateOfBirth: IstDay, today: IstDay): string {
  return `Age ${yearsBetween(dateOfBirth, today)}`;
}

/**
 * The name the header greets the user with and Settings shows (REQ-HOME-001): the first word of the
 * profile's name, or the part of the email before "@" (MVP default, D-23).
 */
export function greetingName(profileName: string | null | undefined, email: string | null): string {
  return profileName?.trim().split(/\s+/)[0] || nameFromEmail(email);
}

/** The letter on an avatar with no photo. */
export function initialOf(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
}
