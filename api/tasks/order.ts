import { getPool } from '../../server/db.js';
import { createTaskOrderHandler } from '../../server/taskOrderHandler.js';
import { createTasksRepository } from '../../server/tasksRepository.js';

export default createTaskOrderHandler(() => createTasksRepository(getPool()));
