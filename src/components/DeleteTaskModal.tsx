import { useState } from 'react';
import { deleteTask } from '../api/tasksApi';
import { errorMessageFor } from '../lib/apiErrors';
import { messages } from '../messages';
import Modal from './Modal';

type Props = {
  taskId: string;
  onCancel: () => void;
  onDeleted: (id: string) => void;
};

// Delete confirmation. Cancel, Esc and the overlay close it without a request; a failure keeps it
// open with the message so the user can retry or cancel.
export default function DeleteTaskModal({ taskId, onCancel, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteTask(taskId);
      onDeleted(taskId);
    } catch (err) {
      setError(errorMessageFor(err, messages.deleteFailed).content ?? messages.deleteFailed);
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="מחיקת משימה"
      onClose={onCancel}
      closeDisabled={deleting}
      closeOnOverlayClick
      showCloseIcon={false}
      className="delete-modal"
    >
      <p className="modal-question">{messages.deleteQuestion}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          ביטול
        </button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={deleting}>
          אישור
        </button>
      </div>
    </Modal>
  );
}
