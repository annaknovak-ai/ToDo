import type { Task } from '../../shared/types';
import { taskLabel } from '../lib/taskLabel';

type Props = {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
};

export default function TaskRow({ task, selected, onSelect }: Props) {
  const label = taskLabel(task);
  const classes = ['task-row'];
  if (selected) classes.push('is-selected');
  if (task.completed) classes.push('is-completed');

  return (
    <li className={classes.join(' ')} data-testid="task-row" data-task-id={task.id}>
      {/* Read-only completion indicator; toggling is added in Milestone 4. */}
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        disabled
        readOnly
        aria-label={task.completed ? 'הושלמה' : 'לביצוע'}
      />
      <button
        type="button"
        className="task-select"
        aria-pressed={selected}
        onClick={() => onSelect(task.id)}
        title={label}
      >
        <span className="task-label">{label}</span>
      </button>
    </li>
  );
}
