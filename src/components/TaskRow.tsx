import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../shared/types';
import { taskLabel } from '../lib/taskLabel';

type Props = {
  task: Task;
  selected: boolean;
  statusPending: boolean;
  dragDisabled: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
};

// One row: label (selects the task), completion checkbox, and drag handle, right to left as in the
// wireframes. Dragging starts only from the handle, so it never selects the row or toggles the box.
export default function TaskRow({ task, selected, statusPending, dragDisabled, onSelect, onToggle }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  });
  const label = taskLabel(task);
  const classes = ['task-row'];
  if (selected) classes.push('is-selected');
  if (task.completed) classes.push('is-completed');
  if (isDragging) classes.push('is-dragging');

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classes.join(' ')}
      data-testid="task-row"
      data-task-id={task.id}
    >
      <button
        type="button"
        className="task-select"
        data-testid="task-select"
        aria-pressed={selected}
        onClick={() => onSelect(task.id)}
        title={label}
      >
        <span className="task-label">{label}</span>
      </button>
      {/* The label only enlarges the touch area around the small box. */}
      <label className="task-check">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.completed}
          disabled={statusPending}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          aria-label={label}
        />
      </label>
      <button
        type="button"
        className="drag-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="גרור כדי לשנות את הסדר"
        aria-disabled={dragDisabled || undefined}
        data-testid="drag-handle"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <g fill="currentColor">
            <circle cx="5.5" cy="3.5" r="1.3" />
            <circle cx="10.5" cy="3.5" r="1.3" />
            <circle cx="5.5" cy="8" r="1.3" />
            <circle cx="10.5" cy="8" r="1.3" />
            <circle cx="5.5" cy="12.5" r="1.3" />
            <circle cx="10.5" cy="12.5" r="1.3" />
          </g>
        </svg>
      </button>
    </li>
  );
}
