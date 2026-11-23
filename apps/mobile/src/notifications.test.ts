import { actionLabel, KIND_INFO, newNotification, timeAgo } from './notifications';

// What a notification says (REQ-NOT-006): the kind of event only, never a value.

describe('notification text', () => {
  it('has no number or name in any notification or button', () => {
    for (const info of Object.values(KIND_INFO)) {
      expect(info.title).not.toMatch(/\d/);
      expect(info.action).not.toMatch(/\d/);
    }
  });

  it('every kind has a button, and an unknown kind opens', () => {
    expect(actionLabel('meal_dinner')).toBe('Log dinner');
    expect(actionLabel('something_new')).toBe('Open');
  });

  it('keys a notification by its kind and its IST day', () => {
    // 22:00 UTC on the 22nd is 03:30 IST on the 23rd.
    expect(newNotification('inactive', 'x', new Date('2026-11-22T22:00:00Z')).dedupeKey).toBe('inactive:2026-11-23');
  });
});

describe('time ago', () => {
  const now = new Date('2026-11-23T10:00:00Z'); // 15:30 IST
  it('says how long, then yesterday, then the date', () => {
    expect(timeAgo('2026-11-23T09:59:40Z', now)).toBe('Just now');
    expect(timeAgo('2026-11-23T09:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-23T04:00:00Z', now)).toBe('6 h ago');
    expect(timeAgo('2026-11-22T10:00:00Z', now)).toBe('Yesterday');
    expect(timeAgo('2026-11-17T10:00:00Z', now)).toBe('Tue 17 Nov');
  });
});
