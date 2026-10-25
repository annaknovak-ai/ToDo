import type { Task } from '../../shared/types';

// Loads the shared task list from the server. Throws on any failure.
export async function listTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response');
  return data as Task[];
}
