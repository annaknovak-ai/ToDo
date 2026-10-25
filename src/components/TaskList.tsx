import type { Task } from '../../shared/types';
import { messages } from '../messages';
import TaskRow from './TaskRow';

export type LoadStatus = 'loading' | 'ready' | 'error';

type Props = {
  status: LoadStatus;
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function TaskList({ status, tasks, selectedId, onSelect }: Props) {
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
      <ul className="task-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} selected={task.id === selectedId} onSelect={onSelect} />
        ))}
      </ul>
    );
  }

  return (
    <section className="panel list-panel" aria-labelledby="list-heading">
      <h2 id="list-heading" className="panel-title">
        רשימת משימות
      </h2>
      <div className="panel-body list-body" data-testid="list-body">
        {content}
      </div>
    </section>
  );
}
