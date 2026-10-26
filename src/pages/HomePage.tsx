import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../../shared/types';
import { MAX_TASKS } from '../../shared/validation';
import { ApiRequestError, listTasks, saveTaskOrder, setTaskStatus } from '../api/tasksApi';
import TaskList, { type ListNotice, type LoadStatus } from '../components/TaskList';
import TaskDetails from '../components/TaskDetails';
import CreateTaskModal from '../components/CreateTaskModal';
import { listActionMessage } from '../lib/apiErrors';
import { applyOrder, moveTask, withServerPositions } from '../lib/taskOrder';
import { messages } from '../messages';

// Must match the mobile breakpoint in styles.css.
const MOBILE_QUERY = '(max-width: 767px)';

export default function HomePage() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Checkboxes stay disabled until their own request ends, so answers cannot arrive out of order (ADR-9).
  const [pendingStatusIds, setPendingStatusIds] = useState<ReadonlySet<string>>(new Set());
  // Another drag waits until the previous order is saved (ADR-9).
  const [orderSaving, setOrderSaving] = useState(false);
  const [notice, setNotice] = useState<ListNotice | null>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const mounted = useRef(true);

  // Loads the list from the server: on entering the page, and from "refresh the list" after a 409.
  // The selection (and so the unsaved draft) is kept when the selected task still exists.
  const loadList = useCallback(() => {
    setStatus('loading');
    setNotice(null);
    listTasks()
      .then((loaded) => {
        if (!mounted.current) return;
        setTasks(loaded);
        setSelectedId((current) => (current && loaded.some((t) => t.id === current) ? current : null));
        setStatus('ready');
      })
      .catch(() => {
        if (mounted.current) setStatus('error');
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadList();
    return () => {
      mounted.current = false;
    };
  }, [loadList]);

  // Shows the new status at once; on failure puts back only this task's status (ADR-9).
  async function handleToggle(id: string, completed: boolean) {
    if (pendingStatusIds.has(id)) return;
    const setCompleted = (value: boolean) =>
      setTasks((current) => current.map((t) => (t.id === id && t.completed !== value ? { ...t, completed: value } : t)));
    setNotice(null);
    setCompleted(completed);
    setPendingStatusIds((current) => new Set(current).add(id));
    try {
      const saved = await setTaskStatus(id, completed);
      if (mounted.current) setCompleted(saved.completed);
    } catch (error) {
      if (!mounted.current) return;
      setCompleted(!completed);
      setNotice({ message: listActionMessage(error, messages.statusFailed), canRefresh: false });
    } finally {
      if (mounted.current) {
        setPendingStatusIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
  }

  // Shows the new order at once; on failure puts back only the previous order (ADR-9).
  async function handleReorder(activeId: string, overId: string) {
    if (orderSaving) return;
    const previousIds = tasks.map((t) => t.id);
    const moved = moveTask(tasks, activeId, overId);
    if (moved === tasks) return;
    setNotice(null);
    setTasks(moved);
    setOrderSaving(true);
    try {
      const saved = await saveTaskOrder(moved.map((t) => t.id));
      if (mounted.current) setTasks((current) => withServerPositions(current, saved));
    } catch (error) {
      if (!mounted.current) return;
      setTasks((current) => applyOrder(current, previousIds));
      const conflict = error instanceof ApiRequestError && error.status === 409;
      setNotice({ message: listActionMessage(error, messages.orderFailed), canRefresh: conflict });
    } finally {
      if (mounted.current) setOrderSaving(false);
    }
  }

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
        <TaskList
          status={status}
          tasks={tasks}
          selectedId={selectedId}
          pendingStatusIds={pendingStatusIds}
          dragDisabled={orderSaving}
          notice={notice}
          onSelect={handleSelect}
          onToggle={handleToggle}
          onReorder={handleReorder}
          onRefresh={loadList}
        />
        <TaskDetails task={selectedTask} onSaved={handleSaved} onDeleted={handleDeleted} ref={detailsRef} />
      </div>
      {creating && <CreateTaskModal onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </main>
  );
}
