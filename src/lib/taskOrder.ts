import { arrayMove } from '@dnd-kit/sortable';
import type { Task } from '../../shared/types';

// Moves the task activeId to where overId is, renumbering positions by index.
export function moveTask(tasks: Task[], activeId: string, overId: string): Task[] {
  const from = tasks.findIndex((t) => t.id === activeId);
  const to = tasks.findIndex((t) => t.id === overId);
  if (from < 0 || to < 0 || from === to) return tasks;
  return arrayMove(tasks, from, to).map((t, index) => (t.position === index ? t : { ...t, position: index }));
}

// Puts the current tasks back in the order of orderedIds, keeping their other fields. Tasks not in
// orderedIds (created meanwhile) stay at the end in their current order; unknown ids are skipped.
export function applyOrder(tasks: Task[], orderedIds: string[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const listed = new Set(orderedIds);
  const ordered = [
    ...orderedIds.flatMap((id) => byId.get(id) ?? []),
    ...tasks.filter((t) => !listed.has(t.id)),
  ];
  return ordered.map((t, index) => (t.position === index ? t : { ...t, position: index }));
}

// Takes only the positions from a saved order, so a status change still in flight is not overwritten.
export function withServerPositions(tasks: Task[], saved: Task[]): Task[] {
  const positions = new Map(saved.map((t) => [t.id, t.position]));
  return tasks.map((t) => {
    const position = positions.get(t.id);
    return position === undefined || position === t.position ? t : { ...t, position };
  });
}
