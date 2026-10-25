import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { TaskInput } from '../shared/types.js';
import { PRODUCT_TIME_ZONE, todayInTimeZone, validateTaskInput } from '../shared/validation.js';
import { allowMethods, requireJsonBody, sendError, sendJson, sendServerError, sendValidationError } from './http.js';
import { MAX_BODY_BYTES } from './tasksHandler.js';
import { TaskNotFoundError, TaskValidationError, type TasksRepository } from './tasksRepository.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TASK_NOT_FOUND_MESSAGE = 'המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה.';

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

// A details update must carry all three editable fields (each a string or null), so a partial
// body cannot clear a field by accident (ADR-8). Anything else in the body is ignored.
function parseDetailsInput(body: unknown): TaskInput | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  if (!('title' in fields) || !('description' in fields) || !('dueDate' in fields)) return null;
  const { title, description, dueDate } = fields;
  if (!isNullableString(title) || !isNullableString(description) || !isNullableString(dueDate)) return null;
  return { title, description, dueDate };
}

// /api/tasks/:id: PATCH updates the task details; DELETE removes the task.
export function createTaskHandler(getRepository: () => TasksRepository, now: () => Date = () => new Date()) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!allowMethods(req, res, ['PATCH', 'DELETE'])) return;
    const id = req.query?.id;
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
      return;
    }
    try {
      if (req.method === 'DELETE') {
        await getRepository().deleteTask(id);
        res.setHeader('Cache-Control', 'no-store');
        res.status(204).end();
        return;
      }

      if (!requireJsonBody(req, res, MAX_BODY_BYTES)) return;
      const input = parseDetailsInput(req.body);
      if (!input) {
        sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
        return;
      }
      const today = todayInTimeZone(PRODUCT_TIME_ZONE, now());
      const task = await getRepository().updateTaskDetails(id, (savedDueDate) =>
        validateTaskInput(input, { today, savedDueDate }),
      );
      sendJson(res, 200, task);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        sendError(res, 404, 'TASK_NOT_FOUND', TASK_NOT_FOUND_MESSAGE);
        return;
      }
      if (error instanceof TaskValidationError) {
        sendValidationError(res, error.errors);
        return;
      }
      sendServerError(res, error);
    }
  };
}
