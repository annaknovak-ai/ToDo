import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  // While true, the close icon, Esc and the overlay do nothing (e.g. while a request is being sent).
  closeDisabled?: boolean;
  // Whether a click on the overlay outside the window closes it (the delete confirmation does).
  closeOnOverlayClick?: boolean;
  showCloseIcon?: boolean;
  className?: string;
  children: ReactNode;
};

// A modal window over the page, built on the native <dialog> (focus stays inside, page behind is inert).
// Mount it to open, unmount it to close. By default clicking the overlay does not close it.
export default function Modal({
  title,
  onClose,
  closeDisabled = false,
  closeOnOverlayClick = false,
  showCloseIcon = true,
  className,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (!closeOnOverlayClick || closeDisabled || event.target !== event.currentTarget) return;
    // A click on the dialog element itself is either on its padding or on the backdrop around it.
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) onClose();
  }

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
      onClick={handleClick}
    >
      <div className="modal-header">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {showCloseIcon && (
          <button type="button" className="icon-button" aria-label="סגור" onClick={onClose} disabled={closeDisabled}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
