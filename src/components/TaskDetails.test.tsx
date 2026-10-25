import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import App from '../App';
import type { Task } from '../../shared/types';
import { validationMessages } from '../../shared/validation';
import { messages } from '../messages';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const existing: Task[] = [
  { id: ID_A, title: 'לקנות מצרכים', description: 'חלב ולחם', dueDate: '2026-11-01', completed: false, position: 0 },
  // Its saved due date is already in the past.
  { id: ID_B, title: 'לתכנן חופשה', description: null, dueDate: '2026-01-10', completed: true, position: 1 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Handler = (id: string, body?: Record<string, unknown>) => Promise<Response>;

// The server's answer to a successful PATCH: the trimmed details on top of the stored task.
function updated(id: string, body: Record<string, unknown>): Task {
  const trim = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const task = existing.find((t) => t.id === id)!;
  return { ...task, title: trim(body.title), description: trim(body.description), dueDate: (body.dueDate as string) ?? null };
}

// Answers GET with the list, PATCH with `onPatch` and DELETE with `onDelete`; returns the fetch mock.
function mockApi({
  onPatch = async (id, body) => jsonResponse(updated(id, body!)),
  onDelete = async () => new Response(null, { status: 204 }),
}: { onPatch?: Handler; onDelete?: Handler } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const id = url.split('/').pop()!;
    if (init?.method === 'PATCH') return onPatch(id, JSON.parse(String(init.body)));
    if (init?.method === 'DELETE') return onDelete(id);
    return jsonResponse(existing);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsWith = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

const details = () => within(screen.getByTestId('details-panel'));

async function renderAndSelect(name: string) {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole('button', { name }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('editing the selected task', () => {
  it('shows editable fields with the task values and both actions', async () => {
    mockApi();
    await renderAndSelect('לקנות מצרכים');
    expect(details().getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
    expect(details().getByLabelText('כותרת')).not.toHaveAttribute('readonly');
    expect(details().getByLabelText('תיאור')).toHaveValue('חלב ולחם');
    expect(details().getByLabelText('תאריך יעד')).toHaveValue('2026-11-01');
    expect(details().getByRole('button', { name: 'שמור שינויים' })).toBeEnabled();
    expect(details().getByRole('button', { name: 'מחק משימה' })).toBeEnabled();
  });

  it('saves the three fields, shows the success message and updates the row', async () => {
    const fetchMock = mockApi();
    await renderAndSelect('לקנות מצרכים');
    const title = details().getByLabelText('כותרת');
    await userEvent.clear(title);
    await userEvent.type(title, '  לקנות פירות ');
    fireEvent.change(details().getByLabelText('תאריך יעד'), { target: { value: '2026-12-01' } });
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));

    expect(await details().findByRole('status')).toHaveTextContent(messages.saveSuccess);
    const [[url, init]] = callsWith(fetchMock, 'PATCH');
    expect(url).toBe(`/api/tasks/${ID_A}`);
    expect(JSON.parse(String(init!.body))).toEqual({ title: '  לקנות פירות ', description: 'חלב ולחם', dueDate: '2026-12-01' });
    // The form shows the normalized values from the server, and the list row follows.
    expect(title).toHaveValue('לקנות פירות');
    expect(screen.getByRole('button', { name: 'לקנות פירות' })).toBeInTheDocument();
  });

  it('hides the success message once a field changes again', async () => {
    mockApi();
    await renderAndSelect('לקנות מצרכים');
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    await details().findByRole('status');
    await userEvent.type(details().getByLabelText('תיאור'), '!');
    expect(details().queryByRole('status')).not.toBeInTheDocument();
  });

  it('disables save and delete while the save request is in flight', async () => {
    let answer!: (response: Response) => void;
    const fetchMock = mockApi({ onPatch: () => new Promise((resolve) => (answer = resolve)) });
    await renderAndSelect('לקנות מצרכים');
    const save = details().getByRole('button', { name: 'שמור שינויים' });
    await userEvent.click(save);
    expect(save).toBeDisabled();
    expect(details().getByRole('button', { name: 'מחק משימה' })).toBeDisabled();
    await userEvent.click(save);
    expect(callsWith(fetchMock, 'PATCH')).toHaveLength(1);

    answer(jsonResponse(existing[0]));
    await waitFor(() => expect(save).toBeEnabled());
  });

  it.each([
    ['empty title and description', { title: '', description: '' }, validationMessages.content],
    ['a title over 100 characters', { title: 'א'.repeat(101) }, validationMessages.titleTooLong],
    ['a due date changed to the past', { dueDate: '2026-10-24' }, validationMessages.dueDateInPast],
  ])('blocks %s inside the form without a request', async (_case, values, message) => {
    const fetchMock = mockApi();
    await renderAndSelect('לקנות מצרכים');
    for (const [field, value] of Object.entries(values)) {
      const label = { title: 'כותרת', description: 'תיאור', dueDate: 'תאריך יעד' }[field]!;
      fireEvent.change(details().getByLabelText(label), { target: { value } });
    }
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(details().getByText(message)).toBeInTheDocument();
    expect(callsWith(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('saves a task whose stored due date is already past when the date is not changed', async () => {
    const fetchMock = mockApi();
    await renderAndSelect('לתכנן חופשה');
    await userEvent.type(details().getByLabelText('תיאור'), 'לבדוק מחירים');
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(await details().findByRole('status')).toHaveTextContent(messages.saveSuccess);
    expect(JSON.parse(String(callsWith(fetchMock, 'PATCH')[0][1]!.body))).toMatchObject({ dueDate: '2026-01-10' });
  });

  it('keeps the values and shows an error when saving fails, and a retry succeeds', async () => {
    let fail = true;
    mockApi({
      onPatch: async (id, body) =>
        fail ? jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500) : jsonResponse(updated(id, body!)),
    });
    await renderAndSelect('לקנות מצרכים');
    fireEvent.change(details().getByLabelText('כותרת'), { target: { value: 'שינוי' } });
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(await details().findByRole('alert')).toHaveTextContent(messages.saveFailed);
    expect(details().getByLabelText('כותרת')).toHaveValue('שינוי');

    fail = false;
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(await details().findByRole('status')).toHaveTextContent(messages.saveSuccess);
  });

  it('shows the "task no longer exists" message on 404 and keeps the values', async () => {
    mockApi({
      onPatch: async () => jsonResponse({ error: { code: 'TASK_NOT_FOUND', message: messages.taskGone } }, 404),
    });
    await renderAndSelect('לקנות מצרכים');
    fireEvent.change(details().getByLabelText('כותרת'), { target: { value: 'שינוי' } });
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(await details().findByRole('alert')).toHaveTextContent(messages.taskGone);
    expect(details().getByLabelText('כותרת')).toHaveValue('שינוי');
  });

  it('shows a server validation error next to its field', async () => {
    mockApi({
      onPatch: async () =>
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message: validationMessages.dueDateInPast, field: 'dueDate' } }, 422),
    });
    await renderAndSelect('לקנות מצרכים');
    await userEvent.click(details().getByRole('button', { name: 'שמור שינויים' }));
    expect(await details().findByText(validationMessages.dueDateInPast)).toBeInTheDocument();
    expect(details().getByLabelText('תאריך יעד')).toHaveAttribute('aria-invalid', 'true');
  });

  it('discards unsaved changes when another task is selected, without a request', async () => {
    const fetchMock = mockApi();
    await renderAndSelect('לקנות מצרכים');
    fireEvent.change(details().getByLabelText('כותרת'), { target: { value: 'טיוטה' } });
    await userEvent.click(screen.getByRole('button', { name: 'לתכנן חופשה' }));
    await userEvent.click(screen.getByRole('button', { name: 'לקנות מצרכים' }));
    expect(details().getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
    expect(callsWith(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('keeps the draft when the same task is clicked again', async () => {
    mockApi();
    await renderAndSelect('לקנות מצרכים');
    fireEvent.change(details().getByLabelText('תיאור'), { target: { value: 'טיוטה' } });
    await userEvent.click(screen.getByRole('button', { name: 'לקנות מצרכים' }));
    expect(details().getByLabelText('תיאור')).toHaveValue('טיוטה');
  });

  it('discards unsaved changes when leaving for the about page', async () => {
    mockApi();
    await renderAndSelect('לקנות מצרכים');
    fireEvent.change(details().getByLabelText('כותרת'), { target: { value: 'טיוטה' } });
    await userEvent.click(screen.getByRole('link', { name: 'אודות' }));
    await userEvent.click(screen.getByRole('link', { name: 'דף הבית' }));
    await userEvent.click(await screen.findByRole('button', { name: 'לקנות מצרכים' }));
    expect(details().getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
  });
});

describe('deleting the selected task', () => {
  async function openConfirm(name = 'לקנות מצרכים') {
    await renderAndSelect(name);
    await userEvent.click(details().getByRole('button', { name: 'מחק משימה' }));
    return screen.getByRole('dialog', { name: 'מחיקת משימה' });
  }

  it('asks for confirmation with the question, cancel and confirm, and no close icon', async () => {
    mockApi();
    const dialog = await openConfirm();
    expect(within(dialog).getByText(messages.deleteQuestion)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'ביטול' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'אישור' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'סגור' })).not.toBeInTheDocument();
  });

  it.each([
    ['the cancel button', (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }))],
    ['Esc', (dialog: HTMLElement) => fireEvent(dialog, new Event('cancel', { cancelable: true }))],
    // A click on the dialog element outside its box is a click on the overlay.
    ['the overlay', (dialog: HTMLElement) => fireEvent.click(dialog, { clientX: 5000, clientY: 5000 })],
  ])('cancels with %s, sends nothing and keeps the task', async (_case, cancel) => {
    const fetchMock = mockApi();
    const dialog = await openConfirm();
    await cancel(dialog);
    expect(screen.queryByRole('dialog', { name: 'מחיקת משימה' })).not.toBeInTheDocument();
    expect(callsWith(fetchMock, 'DELETE')).toHaveLength(0);
    expect(details().getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
  });

  it('a click inside the window does not cancel', async () => {
    mockApi();
    const dialog = await openConfirm();
    fireEvent.click(within(dialog).getByText(messages.deleteQuestion));
    expect(screen.getByRole('dialog', { name: 'מחיקת משימה' })).toBeInTheDocument();
  });

  it('confirm deletes on the server, removes the row and resets the details area', async () => {
    const fetchMock = mockApi();
    const dialog = await openConfirm();
    await userEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'מחיקת משימה' })).not.toBeInTheDocument());
    expect(callsWith(fetchMock, 'DELETE')[0][0]).toBe(`/api/tasks/${ID_A}`);
    expect(screen.queryByRole('button', { name: 'לקנות מצרכים' })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);
    expect(screen.getByText(messages.noSelection)).toBeInTheDocument();
  });

  it('blocks confirm, cancel and Esc while the delete request is in flight', async () => {
    let answer!: (response: Response) => void;
    const fetchMock = mockApi({ onDelete: () => new Promise((resolve) => (answer = resolve)) });
    const dialog = await openConfirm();
    const confirm = within(dialog).getByRole('button', { name: 'אישור' });
    await userEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'ביטול' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(dialog, { clientX: 5000, clientY: 5000 });
    expect(screen.getByRole('dialog', { name: 'מחיקת משימה' })).toBeInTheDocument();
    expect(callsWith(fetchMock, 'DELETE')).toHaveLength(1);

    answer(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.getByText(messages.noSelection)).toBeInTheDocument());
  });

  it.each([
    [500, { code: 'INTERNAL_ERROR', message: 'x' }, messages.deleteFailed],
    [404, { code: 'TASK_NOT_FOUND', message: messages.taskGone }, messages.taskGone],
  ])('on a %i failure keeps the task and shows the message in the window', async (status, error, message) => {
    mockApi({ onDelete: async () => jsonResponse({ error }, status) });
    const dialog = await openConfirm();
    await userEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByRole('button', { name: 'אישור' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'לקנות מצרכים' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(details().getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
  });

  it('shows the delete-failed message when the network fails', async () => {
    mockApi({ onDelete: () => Promise.reject(new TypeError('Failed to fetch')) });
    const dialog = await openConfirm();
    await userEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(messages.deleteFailed);
  });
});
