import type { ValidationErrors, ValidationField } from '../../shared/validation';
import { ApiRequestError } from '../api/tasksApi';
import { messages } from '../messages';

// Field errors from the server that belong next to a field; anything else goes to the form message.
const FIELD_ERRORS: ValidationField[] = ['title', 'description', 'dueDate'];

// Turns a failed create/update/delete into form errors. `fallback` is the generic failure message
// of that action (save failed / delete failed).
export function errorMessageFor(error: unknown, fallback: string): ValidationErrors {
  if (error instanceof ApiRequestError) {
    if (error.status === 404 && error.code === 'TASK_NOT_FOUND') return { content: messages.taskGone };
    if (error.status === 409 && error.code === 'TASK_LIMIT_REACHED') return { content: messages.listFullOnCreate };
    if (error.status === 422 && error.message) {
      const field = FIELD_ERRORS.includes(error.field as ValidationField) ? (error.field as ValidationField) : 'content';
      return { [field]: error.message };
    }
    if (error.status === 429) return { content: messages.tooManyRequests };
    return { content: fallback };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { content: messages.offline };
  return { content: fallback };
}
