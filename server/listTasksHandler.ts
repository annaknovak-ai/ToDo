import type { VercelRequest, VercelResponse } from '@vercel/node';
import { allowMethods, sendJson, sendServerError } from './http.js';
import type { TasksRepository } from './tasksRepository.js';

// GET /api/tasks: the whole list in its saved order.
export function createListTasksHandler(getRepository: () => TasksRepository) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (!allowMethods(req, res, ['GET'])) return;
    try {
      const tasks = await getRepository().listTasks();
      sendJson(res, 200, tasks);
    } catch (error) {
      sendServerError(res, error);
    }
  };
}
