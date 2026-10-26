import { useId, useState, type FormEvent, type Ref } from 'react';
import type { Task } from '../../shared/types';
import { validateTaskInput, type ValidationErrors, type ValidationField } from '../../shared/validation';
import { updateTask } from '../api/tasksApi';
import { errorMessageFor } from '../lib/apiErrors';
import { localToday } from '../lib/dates';
import { messages } from '../messages';
import DeleteTaskModal from './DeleteTaskModal';

type Props = {
  task: Task | null;
  onSaved?: (task: Task) => void;
  onDeleted?: (id: string) => void;
  ref?: Ref<HTMLElement>;
};

type EditorProps = {
  task: Task;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
};

// Inline editor for the selected task. The draft lives only in this component's state: the parent
// mounts a fresh instance per task (key), so switching tasks, leaving the page or refreshing discards it.
function TaskEditor({ task, onSaved, onDeleted }: EditorProps) {
  const [today] = useState(localToday);
  // The due date stored on the server, against which the "not in the past" rule is checked.
  const [savedDueDate, setSavedDueDate] = useState(task.dueDate);
  const [title, setTitle] = useState(task.title ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function edited(...fields: ValidationField[]) {
    setSaved(false);
    setErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const input = { title, description, dueDate: dueDate || null };
    const validation = validateTaskInput(input, { today, savedDueDate });
    setSaved(false);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // The server trims and normalizes the values itself.
      const result = await updateTask(task.id, input);
      setTitle(result.title ?? '');
      setDescription(result.description ?? '');
      setDueDate(result.dueDate ?? '');
      setSavedDueDate(result.dueDate);
      setSaved(true);
      onSaved(result);
    } catch (error) {
      setErrors(errorMessageFor(error, messages.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  const idPrefix = useId();
  const idFor = (field: ValidationField) => `${idPrefix}-${field}`;
  const fieldProps = (field: ValidationField) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${idFor(field)}-error` } : {};
  // Errors sit outside the <label> so the field's accessible name stays just the label text.
  const fieldError = (field: ValidationField) =>
    errors[field] && (
      <span id={`${idFor(field)}-error`} className="field-error">
        {errors[field]}
      </span>
    );

  return (
    <>
      {/* noValidate: a saved due date that is already past must stay savable (ADR-5); the rules run in code. */}
      <form className="details-form" noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor={idFor('title')}>
            כותרת
          </label>
          <input
            id={idFor('title')}
            type="text"
            value={title}
            placeholder={messages.titlePlaceholder}
            onChange={(e) => {
              setTitle(e.target.value);
              edited('title', 'content');
            }}
            {...fieldProps('title')}
          />
          {fieldError('title')}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={idFor('description')}>
            תיאור
          </label>
          <textarea
            id={idFor('description')}
            value={description}
            rows={5}
            placeholder={messages.descriptionPlaceholder}
            onChange={(e) => {
              setDescription(e.target.value);
              edited('description', 'content');
            }}
            {...fieldProps('description')}
          />
          {fieldError('description')}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={idFor('dueDate')}>
            תאריך יעד
          </label>
          <input
            id={idFor('dueDate')}
            type="date"
            value={dueDate}
            min={today}
            onChange={(e) => {
              setDueDate(e.target.value);
              edited('dueDate');
            }}
            {...fieldProps('dueDate')}
          />
          {fieldError('dueDate')}
        </div>
        {errors.content && (
          <p className="form-error" role="alert">
            {errors.content}
          </p>
        )}
        {saved && (
          <p className="form-success" role="status">
            {messages.saveSuccess}
          </p>
        )}
        <div className="details-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            שמור שינויים
          </button>
          <button
            type="button"
            className="btn btn-danger-outline"
            disabled={saving}
            onClick={() => setConfirmingDelete(true)}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            מחק משימה
          </button>
        </div>
      </form>
      {confirmingDelete && (
        <DeleteTaskModal taskId={task.id} onCancel={() => setConfirmingDelete(false)} onDeleted={onDeleted} />
      )}
    </>
  );
}

// The details area: the selection hint, or the editor for the selected task.
export default function TaskDetails({ task, onSaved = () => {}, onDeleted = () => {}, ref }: Props) {
  return (
    <section className="panel details-panel" aria-labelledby="details-heading" ref={ref} data-testid="details-panel">
      <h2 id="details-heading" className="panel-title">
        פרטי משימה
      </h2>
      <div className="panel-body">
        {task ? (
          <TaskEditor key={task.id} task={task} onSaved={onSaved} onDeleted={onDeleted} />
        ) : (
          <p className="panel-message">{messages.noSelection}</p>
        )}
      </div>
    </section>
  );
}
