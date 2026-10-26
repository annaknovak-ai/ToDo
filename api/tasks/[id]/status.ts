import { getPool } from '../../../server/db.js';
import { createTaskStatusHandler } from '../../../server/taskStatusHandler.js';
import { createTasksRepository } from '../../../server/tasksRepository.js';

export default createTaskStatusHandler(() => createTasksRepository(getPool()));
