import { useEffect, useRef, useState } from 'react';
import type { Task } from '../../shared/types';
import { MAX_TASKS } from '../../shared/validation';
import { listTasks } from '../api/tasksApi';
import TaskList, { type LoadStatus } from '../components/TaskList';
import TaskDetails from '../components/TaskDetails';
import CreateTaskModal from '../components/CreateTaskModal';
import { messages } from '../messages';

// Must match the mobile breakpoint in styles.css.
const MOBILE_QUERY = '(max-width: 767px)';

export default function HomePage() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    listTasks()
      .then((loaded) => {
        if (cancelled) return;
        setTasks(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelect(id: string) {
    setSelectedId(id);
    // On narrow screens the details are below the list; bring them into view.
    if (window.matchMedia?.(MOBILE_QUERY).matches) {
      requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function handleCreated(task: Task) {
    setTasks((current) => [...current, task]);
    setCreating(false);
    handleSelect(task.id);
    // On desktop the list scrolls inside its panel; show the new row at its end.
    if (!window.matchMedia?.(MOBILE_QUERY).matches) {
      requestAnimationFrame(() =>
        document.querySelector(`[data-task-id="${task.id}"]`)?.scrollIntoView?.({ block: 'nearest' }),
      );
    }
  }

  // Only the detail fields come from the save answer, so a status change made meanwhile is kept (ADR-9).
  function handleSaved(saved: Task) {
    setTasks((current) =>
      current.map((t) =>
        t.id === saved.id ? { ...t, title: saved.title, description: saved.description, dueDate: saved.dueDate } : t,
      ),
    );
  }

  function handleDeleted(id: string) {
    setTasks((current) => current.filter((t) => t.id !== id));
    setSelectedId(null);
  }

  const listFull = status === 'ready' && tasks.length >= MAX_TASKS;
  // Adding needs a loaded list to append to and select in.
  const canAdd = status === 'ready' && !listFull;
  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <main className="home">
      <div className="home-header">
        <h1>המשימות שלי</h1>
        <div className="add-task">
          {listFull && <p className="add-task-note">{messages.listFull}</p>}
          <button type="button" className="btn btn-primary" disabled={!canAdd} onClick={() => setCreating(true)}>
            הוסף משימה
          </button>
        </div>
      </div>
      <div className="workspace">
        <TaskList status={status} tasks={tasks} selectedId={selectedId} onSelect={handleSelect} />
        <TaskDetails task={selectedTask} onSaved={handleSaved} onDeleted={handleDeleted} ref={detailsRef} />
      </div>
      {creating && <CreateTaskModal onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </main>
  );
}
