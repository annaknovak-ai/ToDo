import { useId, useState, type FormEvent } from 'react';
import type { Task } from '../../shared/types';
import { validateTaskInput, type ValidationErrors, type ValidationField } from '../../shared/validation';
import { createTask } from '../api/tasksApi';
import { errorMessageFor } from '../lib/apiErrors';
import { localToday } from '../lib/dates';
import { messages } from '../messages';
import Modal from './Modal';

type Props = {
  onClose: () => void;
  onCreated: (task: Task) => void;
};

// "Add task" form. A fresh instance is mounted on every open, so closing discards the draft.
export default function CreateTaskModal({ onClose, onCreated }: Props) {
  const [today] = useState(localToday);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function clearErrors(...fields: ValidationField[]) {
    setErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const input = { title, description, dueDate: dueDate || null };
    const validation = validateTaskInput(input, { today });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // The server trims and normalizes the values itself.
      const task = await createTask(input);
      onCreated(task);
    } catch (error) {
      setErrors(errorMessageFor(error, messages.saveFailed));
      setSubmitting(false);
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
    <Modal title="הוספת משימה" onClose={onClose} closeDisabled={submitting} className="create-modal">
      <form className="modal-form" noValidate onSubmit={handleSubmit}>
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
              clearErrors('title', 'content');
            }}
            autoFocus
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
            rows={4}
            placeholder={messages.descriptionPlaceholder}
            onChange={(e) => {
              setDescription(e.target.value);
              clearErrors('description', 'content');
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
              clearErrors('dueDate');
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
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            הוסף משימה
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            סגור
          </button>
        </div>
      </form>
    </Modal>
  );
}
