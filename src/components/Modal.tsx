import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  // While true, the close icon and Esc do nothing (e.g. while a request is being sent).
  closeDisabled?: boolean;
  className?: string;
  children: ReactNode;
};

// A modal window over the page, built on the native <dialog> (focus stays inside, page behind is inert).
// Mount it to open, unmount it to close. Clicking the overlay does not close it.
export default function Modal({ title, onClose, closeDisabled = false, className, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={['modal', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: keep the dialog under React's control.
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <button type="button" className="icon-button" aria-label="סגור" onClick={onClose} disabled={closeDisabled}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}
