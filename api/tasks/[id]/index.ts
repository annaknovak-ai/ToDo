import { getPool } from '../../../server/db.js';
import { createTaskHandler } from '../../../server/taskHandler.js';
import { createTasksRepository } from '../../../server/tasksRepository.js';

export default createTaskHandler(() => createTasksRepository(getPool()));
