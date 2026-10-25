// @vitest-environment node
import { charLength, isValidDateString, todayInTimeZone, validateTaskInput, validationMessages } from './validation.js';

const today = '2026-10-25';
const validate = (title: string | null, description: string | null, dueDate: string | null = null) =>
  validateTaskInput({ title, description, dueDate }, { today });

describe('validateTaskInput', () => {
  it('accepts a title only, a description only, or both', () => {
    expect(validate('כותרת', null)).toEqual({ ok: true, value: { title: 'כותרת', description: null, dueDate: null } });
    expect(validate(null, 'תיאור')).toEqual({ ok: true, value: { title: null, description: 'תיאור', dueDate: null } });
    expect(validate('כ', 'ת', today).ok).toBe(true);
  });

  it('trims text and turns empty text into null', () => {
    expect(validate('  כותרת \n', '   ')).toEqual({ ok: true, value: { title: 'כותרת', description: null, dueDate: null } });
  });

  it('rejects empty or whitespace-only title and description', () => {
    expect(validate(null, null)).toEqual({ ok: false, errors: { content: validationMessages.content } });
    expect(validate('  ', '\n\t ')).toEqual({ ok: false, errors: { content: validationMessages.content } });
  });

  it('enforces the 100 / 2000 character limits', () => {
    expect(validate('א'.repeat(100), 'ב'.repeat(2000)).ok).toBe(true);
    expect(validate('א'.repeat(101), null)).toEqual({ ok: false, errors: { title: validationMessages.titleTooLong } });
    expect(validate(null, 'ב'.repeat(2001))).toEqual({ ok: false, errors: { description: validationMessages.descriptionTooLong } });
  });

  it('counts an emoji as one character', () => {
    expect(validate('😀'.repeat(100), null).ok).toBe(true);
    expect(validate('😀'.repeat(101), null).ok).toBe(false);
  });

  it('accepts today, a future date or no date, and rejects past or invalid dates', () => {
    expect(validate('x', null, today).ok).toBe(true);
    expect(validate('x', null, '2027-01-01').ok).toBe(true);
    expect(validate('x', null, '').ok).toBe(true);
    expect(validate('x', null, '2026-10-24')).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInPast } });
    expect(validate('x', null, '2026-02-30')).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInvalid } });
    expect(validate('x', null, 'abc')).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInvalid } });
  });

  it('returns every error at once', () => {
    const result = validate('א'.repeat(101), 'ב'.repeat(2001), '2020-01-01');
    expect(result).toEqual({
      ok: false,
      errors: {
        title: validationMessages.titleTooLong,
        description: validationMessages.descriptionTooLong,
        dueDate: validationMessages.dueDateInPast,
      },
    });
  });
});

describe('validateTaskInput when updating (savedDueDate)', () => {
  const update = (dueDate: string | null, savedDueDate: string | null) =>
    validateTaskInput({ title: 'x', description: null, dueDate }, { today, savedDueDate });

  it('allows keeping a saved due date that is already in the past', () => {
    expect(update('2026-01-01', '2026-01-01')).toEqual({
      ok: true,
      value: { title: 'x', description: null, dueDate: '2026-01-01' },
    });
  });

  it('rejects changing the due date to another past date', () => {
    expect(update('2026-02-01', '2026-01-01')).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInPast } });
    expect(update('2026-02-01', null)).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInPast } });
  });

  it('allows changing a past due date to today, a future date or no date', () => {
    expect(update(today, '2026-01-01').ok).toBe(true);
    expect(update('2027-03-01', '2026-01-01').ok).toBe(true);
    expect(update(null, '2026-01-01').ok).toBe(true);
    expect(update('', '2026-01-01').ok).toBe(true);
  });

  it('still rejects an invalid date even when it equals the saved value', () => {
    expect(update('2026-02-30', '2026-02-30')).toEqual({ ok: false, errors: { dueDate: validationMessages.dueDateInvalid } });
  });
});

describe('todayInTimeZone', () => {
  it('uses the given time zone, not UTC', () => {
    const lateUtc = new Date('2026-10-25T22:30:00Z');
    expect(todayInTimeZone('Asia/Jerusalem', lateUtc)).toBe('2026-10-26');
    expect(todayInTimeZone('UTC', lateUtc)).toBe('2026-10-25');
  });
});

describe('helpers', () => {
  it('charLength counts code points', () => {
    expect(charLength('אב😀')).toBe(3);
  });

  it('isValidDateString checks real calendar dates', () => {
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2027-02-29')).toBe(false);
    expect(isValidDateString('2026-1-01')).toBe(false);
  });
});
