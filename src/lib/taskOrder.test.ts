import type { Task } from '../../shared/types';
import { applyOrder, moveTask, withServerPositions } from './taskOrder';

const make = (id: string, position: number, completed = false): Task => ({
  id,
  title: id,
  description: null,
  dueDate: null,
  completed,
  position,
});

const ids = (tasks: Task[]) => tasks.map((t) => t.id);
const positions = (tasks: Task[]) => tasks.map((t) => t.position);

describe('moveTask', () => {
  const tasks = [make('a', 0), make('b', 1), make('c', 2), make('d', 3)];

  it('moves a task down and renumbers positions', () => {
    const moved = moveTask(tasks, 'a', 'c');
    expect(ids(moved)).toEqual(['b', 'c', 'a', 'd']);
    expect(positions(moved)).toEqual([0, 1, 2, 3]);
  });

  it('moves a task up', () => {
    expect(ids(moveTask(tasks, 'd', 'a'))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('returns the same array when nothing moves', () => {
    expect(moveTask(tasks, 'b', 'b')).toBe(tasks);
    expect(moveTask(tasks, 'x', 'b')).toBe(tasks);
  });
});

describe('applyOrder', () => {
  it('restores the previous order while keeping the current fields', () => {
    const current = [make('b', 0), make('a', 1, true), make('c', 2)];
    const restored = applyOrder(current, ['a', 'b', 'c']);
    expect(ids(restored)).toEqual(['a', 'b', 'c']);
    expect(positions(restored)).toEqual([0, 1, 2]);
    expect(restored[0].completed).toBe(true);
  });

  it('keeps a task created meanwhile at the end, and skips one deleted meanwhile', () => {
    const current = [make('b', 0), make('a', 1), make('new', 2)];
    expect(ids(applyOrder(current, ['a', 'gone', 'b']))).toEqual(['a', 'b', 'new']);
  });
});

describe('withServerPositions', () => {
  it('takes only positions from the saved list', () => {
    const current = [make('a', 5, true), make('b', 6)];
    const saved = [make('a', 0, false), make('b', 1, true)];
    const result = withServerPositions(current, saved);
    expect(positions(result)).toEqual([0, 1]);
    expect(result.map((t) => t.completed)).toEqual([true, false]);
  });
});
