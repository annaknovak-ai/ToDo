import type { Ref } from 'react';
import type { Task } from '../../shared/types';
import { messages } from '../messages';

type Props = {
  task: Task | null;
  ref?: Ref<HTMLElement>;
};

// Shows the selected task. Fields are read-only until editing arrives in Milestone 3.
export default function TaskDetails({ task, ref }: Props) {
  return (
    <section className="panel details-panel" aria-labelledby="details-heading" ref={ref} data-testid="details-panel">
      <h2 id="details-heading" className="panel-title">
        פרטי משימה
      </h2>
      <div className="panel-body">
        {task ? (
          <form className="details-form" onSubmit={(e) => e.preventDefault()}>
            <label className="field">
              <span className="field-label">כותרת</span>
              <input type="text" value={task.title ?? ''} readOnly />
            </label>
            <label className="field">
              <span className="field-label">תיאור</span>
              <textarea value={task.description ?? ''} rows={5} readOnly />
            </label>
            <label className="field">
              <span className="field-label">תאריך יעד</span>
              <input type="date" value={task.dueDate ?? ''} readOnly />
            </label>
          </form>
        ) : (
          <p className="panel-message">{messages.noSelection}</p>
        )}
      </div>
    </section>
  );
}
