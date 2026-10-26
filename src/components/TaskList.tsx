import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../shared/types';
import { taskLabel } from '../lib/taskLabel';
import { messages } from '../messages';
import TaskRow from './TaskRow';

export type LoadStatus = 'loading' | 'ready' | 'error';

// An error from a status change or reorder, shown above the list.
export type ListNotice = { message: string; canRefresh: boolean };

type Props = {
  status: LoadStatus;
  tasks: Task[];
  selectedId: string | null;
  pendingStatusIds?: ReadonlySet<string>;
  dragDisabled?: boolean;
  notice?: ListNotice | null;
  onSelect: (id: string) => void;
  onToggle?: (id: string, completed: boolean) => void;
  onReorder?: (activeId: string, overId: string) => void;
  onRefresh?: () => void;
};

// Rows only move up and down.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const screenReaderInstructions = {
  draggable: 'כדי להזיז משימה, לחץ רווח או Enter על ידית הגרירה, השתמש בחצים למעלה ולמטה, ולחץ שוב רווח או Enter כדי להניח אותה. Esc מבטל.',
};

export default function TaskList({
  status,
  tasks,
  selectedId,
  pendingStatusIds = new Set(),
  dragDisabled = false,
  notice = null,
  onSelect,
  onToggle = () => {},
  onReorder = () => {},
  onRefresh = () => {},
}: Props) {
  // A small distance keeps a plain tap on the handle from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: string | number) => {
    const task = tasks.find((t) => t.id === id);
    return task ? `"${taskLabel(task)}"` : 'המשימה';
  };
  const placeOf = (id: string | number) => tasks.findIndex((t) => t.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `המשימה ${labelOf(active.id)} הורמה.`,
    onDragOver: ({ active, over }) =>
      over ? `המשימה ${labelOf(active.id)} מעל מקום ${placeOf(over.id)} מתוך ${tasks.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `המשימה ${labelOf(active.id)} הונחה במקום ${placeOf(over.id)}.` : `המשימה ${labelOf(active.id)} הונחה.`,
    onDragCancel: ({ active }) => `הגרירה בוטלה. המשימה ${labelOf(active.id)} חזרה למקומה.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  }

  let content;
  if (status === 'loading') {
    content = <p className="panel-message">{messages.loading}</p>;
  } else if (status === 'error') {
    const text = navigator.onLine === false ? messages.offline : messages.loadFailed;
    content = (
      <p className="panel-message is-error" role="alert">
        {text}
      </p>
    );
  } else if (tasks.length === 0) {
    content = <p className="panel-message">{messages.emptyList}</p>;
  } else {
    content = (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === selectedId}
                statusPending={pendingStatusIds.has(task.id)}
                dragDisabled={dragDisabled}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <section className="panel list-panel" aria-labelledby="list-heading">
      <h2 id="list-heading" className="panel-title">
        רשימת משימות
      </h2>
      {notice && status === 'ready' && (
        <div className="list-notice" role="alert">
          <p>{notice.message}</p>
          {notice.canRefresh && (
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              {messages.refreshList}
            </button>
          )}
        </div>
      )}
      <div className="panel-body list-body" data-testid="list-body">
        {content}
      </div>
    </section>
  );
}
