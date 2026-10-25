import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { TaskInput } from '../shared/types.js';
import { PRODUCT_TIME_ZONE, todayInTimeZone, validateTaskInput, type ValidationField } from '../shared/validation.js';
import { allowMethods, requireJsonBody, sendError, sendJson, sendServerError } from './http.js';
import { TaskLimitError, type TasksRepository } from './tasksRepository.js';

const MAX_BODY_BYTES = 16 * 1024;

const TASK_LIMIT_MESSAGE = 'לא ניתן להוסיף משימה: הרשימה התמלאה. מחק משימה קיימת ונסה שוב.';

// Order in which a single validation error is reported.
const FIELD_ORDER: ValidationField[] = ['content', 'title', 'description', 'dueDate'];

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

// Reads the three editable fields; anything else in the body (e.g. completed, position) is ignored.
function parseTaskInput(body: unknown): TaskInput | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { title, description, dueDate } = body as Record<string, unknown>;
  if (!isNullableString(title) || !isNullableString(description) || !isNullableString(dueDate)) return null;
  return { title: title ?? null, description: description ?? null, dueDate: dueDate ?? null };
}

// /api/tasks: GET returns the whole list in its saved order; POST appends a new task.
export function createTasksHandler(getRepository: () => TasksRepository, now: () => Date = () => new Date()) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!allowMethods(req, res, ['GET', 'POST'])) return;
    try {
      if (req.method === 'GET') {
        sendJson(res, 200, await getRepository().listTasks());
        return;
      }

      if (!requireJsonBody(req, res, MAX_BODY_BYTES)) return;
      const input = parseTaskInput(req.body);
      if (!input) {
        sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
        return;
      }
      const validation = validateTaskInput(input, { today: todayInTimeZone(PRODUCT_TIME_ZONE, now()) });
      if (!validation.ok) {
        const field = FIELD_ORDER.find((f) => validation.errors[f])!;
        sendError(res, 422, 'VALIDATION_ERROR', validation.errors[field]!, field);
        return;
      }
      const task = await getRepository().createTask(validation.value);
      sendJson(res, 201, task);
    } catch (error) {
      if (error instanceof TaskLimitError) {
        sendError(res, 409, 'TASK_LIMIT_REACHED', TASK_LIMIT_MESSAGE);
        return;
      }
      sendServerError(res, error);
    }
  };
}
