import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  allowMethods,
  requireJsonBody,
  requireTaskId,
  sendError,
  sendJson,
  sendServerError,
  TASK_NOT_FOUND_MESSAGE,
} from './http.js';
import { MAX_BODY_BYTES } from './tasksHandler.js';
import { TaskNotFoundError, type TasksRepository } from './tasksRepository.js';

// The body must carry an explicit boolean (not a toggle); anything else in it is ignored.
function parseCompleted(body: unknown): boolean | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { completed } = body as Record<string, unknown>;
  return typeof completed === 'boolean' ? completed : null;
}

// /api/tasks/:id/status: PATCH saves whether the task is completed.
export function createTaskStatusHandler(getRepository: () => TasksRepository) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!allowMethods(req, res, ['PATCH'])) return;
    const id = requireTaskId(req, res);
    if (!id) return;
    if (!requireJsonBody(req, res, MAX_BODY_BYTES)) return;
    const completed = parseCompleted(req.body);
    if (completed === null) {
      sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
      return;
    }
    try {
      sendJson(res, 200, await getRepository().setTaskCompleted(id, completed));
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        sendError(res, 404, 'TASK_NOT_FOUND', TASK_NOT_FOUND_MESSAGE);
        return;
      }
      sendServerError(res, error);
    }
  };
}
