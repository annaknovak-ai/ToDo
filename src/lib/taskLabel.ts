import type { Task } from '../../shared/types';

// Row text: the title, or the description collapsed to a single line.
// Visual truncation is done in CSS.
export function taskLabel(task: Pick<Task, 'title' | 'description'>): string {
  if (task.title) return task.title;
  return (task.description ?? '').replace(/\s+/g, ' ').trim();
}
