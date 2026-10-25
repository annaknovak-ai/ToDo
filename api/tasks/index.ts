import { getPool } from '../../server/db.js';
import { createTasksHandler } from '../../server/tasksHandler.js';
import { createTasksRepository } from '../../server/tasksRepository.js';

export default createTasksHandler(() => createTasksRepository(getPool()));
