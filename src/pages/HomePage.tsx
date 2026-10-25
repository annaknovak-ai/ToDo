import { useEffect, useRef, useState } from 'react';
import type { Task } from '../../shared/types';
import { listTasks } from '../api/tasksApi';
import TaskList, { type LoadStatus } from '../components/TaskList';
import TaskDetails from '../components/TaskDetails';

// Must match the mobile breakpoint in styles.css.
const MOBILE_QUERY = '(max-width: 767px)';

export default function HomePage() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <main className="home">
      <div className="home-header">
        <h1>המשימות שלי</h1>
      </div>
      <div className="workspace">
        <TaskList status={status} tasks={tasks} selectedId={selectedId} onSelect={handleSelect} />
        <TaskDetails task={selectedTask} ref={detailsRef} />
      </div>
    </main>
  );
}
