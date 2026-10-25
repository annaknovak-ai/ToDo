import { getPool } from '../../server/db.js';
import { createListTasksHandler } from '../../server/listTasksHandler.js';
import { createTasksRepository } from '../../server/tasksRepository.js';

export default createListTasksHandler(() => createTasksRepository(getPool()));
