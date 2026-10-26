import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MAX_TASKS } from '../shared/validation.js';
import { allowMethods, isUuid, requireJsonBody, sendError, sendJson, sendServerError } from './http.js';
import { TaskOrderConflictError, type TasksRepository } from './tasksRepository.js';

// 1,000 UUIDs take about 39KB of JSON (ADR-9).
export const ORDER_MAX_BODY_BYTES = 64 * 1024;

const ORDER_CONFLICT_MESSAGE = 'הרשימה השתנתה בינתיים. רענן כדי לראות את הגרסה העדכנית.';

// Reads orderedIds: an array of at most MAX_TASKS UUIDs. Whether they match the list is checked
// by the repository under the list lock.
function parseOrderedIds(body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { orderedIds } = body as Record<string, unknown>;
  if (!Array.isArray(orderedIds) || orderedIds.length > MAX_TASKS) return null;
  return orderedIds.every(isUuid) ? orderedIds : null;
}

// /api/tasks/order: PUT replaces the order of the whole list.
export function createTaskOrderHandler(getRepository: () => TasksRepository) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!allowMethods(req, res, ['PUT'])) return;
    if (!requireJsonBody(req, res, ORDER_MAX_BODY_BYTES)) return;
    const orderedIds = parseOrderedIds(req.body);
    if (!orderedIds) {
      sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
      return;
    }
    try {
      sendJson(res, 200, await getRepository().reorderTasks(orderedIds));
    } catch (error) {
      if (error instanceof TaskOrderConflictError) {
        sendError(res, 409, 'ORDER_CONFLICT', ORDER_CONFLICT_MESSAGE);
        return;
      }
      sendServerError(res, error);
    }
  };
}
