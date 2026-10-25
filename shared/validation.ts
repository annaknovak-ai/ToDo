// Task validation rules and messages shared by the browser and the API (ADR-6).
// Must stay browser-safe: no secrets, no database access.
import type { TaskInput } from './types.js';

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 2000;
export const MAX_TASKS = 1000;

// Time zone that defines "today" for server-side validation (ADR-5).
export const PRODUCT_TIME_ZONE = 'Asia/Jerusalem';

// Verbatim from PRD section 4.ג.
export const validationMessages = {
  content: 'יש להזין כותרת או תיאור למשימה',
  titleTooLong: 'הכותרת יכולה להכיל עד 100 תווים.',
  descriptionTooLong: 'התיאור יכול להכיל עד 2,000 תווים.',
  dueDateInPast: 'תאריך היעד לא יכול להיות בעבר.',
  dueDateInvalid: 'תאריך היעד אינו תקין.',
} as const;

export type ValidationField = 'content' | 'title' | 'description' | 'dueDate';
export type ValidationErrors = Partial<Record<ValidationField, string>>;

export type ValidationResult = { ok: true; value: TaskInput } | { ok: false; errors: ValidationErrors };

// Today's date (YYYY-MM-DD) in the given time zone. Never uses toISOString(), which is UTC.
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Length in characters (code points), the way PostgreSQL varchar counts it.
export function charLength(value: string): number {
  return [...value].length;
}

function normalizeText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Validates and normalizes a task. Returns every error at once so the form can show each next to its field.
// `today` is YYYY-MM-DD; dates are compared as strings.
// When updating, pass the stored due date as `savedDueDate`: the "not in the past" rule then applies
// only if the due date was changed (PRD FR-02, ADR-8).
export function validateTaskInput(
  input: TaskInput,
  options: { today: string; savedDueDate?: string | null },
): ValidationResult {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const dueDate = input.dueDate === '' ? null : input.dueDate;
  const errors: ValidationErrors = {};

  if (title === null && description === null) errors.content = validationMessages.content;
  if (title !== null && charLength(title) > TITLE_MAX) errors.title = validationMessages.titleTooLong;
  if (description !== null && charLength(description) > DESCRIPTION_MAX) {
    errors.description = validationMessages.descriptionTooLong;
  }
  if (dueDate !== null) {
    if (!isValidDateString(dueDate)) errors.dueDate = validationMessages.dueDateInvalid;
    else if (dueDate < options.today && dueDate !== options.savedDueDate) {
      errors.dueDate = validationMessages.dueDateInPast;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, description, dueDate } };
}
