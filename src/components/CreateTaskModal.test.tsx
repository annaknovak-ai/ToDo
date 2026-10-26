import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import App from '../App';
import type { Task } from '../../shared/types';
import { validationMessages } from '../../shared/validation';
import { messages } from '../messages';

const existing: Task[] = [
  { id: 'a', title: 'לקנות מצרכים', description: null, dueDate: null, completed: false, position: 0 },
  { id: 'b', title: 'לתכנן חופשה', description: null, dueDate: null, completed: true, position: 1 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type PostHandler = (body: Record<string, unknown>) => Promise<Response>;

// Answers GET with `list` and POST with `onPost`; returns the fetch mock.
function mockApi(list: Task[], onPost: PostHandler = async (body) => jsonResponse(created(body), 201)) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return onPost(JSON.parse(String(init.body)));
    return jsonResponse(list);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function created(body: Record<string, unknown>): Task {
  const trim = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    id: 'new',
    title: trim(body.title),
    description: trim(body.description),
    dueDate: (body.dueDate as string | null) ?? null,
    completed: false,
    position: 2,
  };
}

const postCalls = (fetchMock: ReturnType<typeof mockApi>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

async function openModal() {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  const addButton = await screen.findByRole('button', { name: 'הוסף משימה' });
  await waitFor(() => expect(addButton).toBeEnabled());
  await userEvent.click(addButton);
  return screen.getByRole('dialog', { name: 'הוספת משימה' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Add task modal', () => {
  it('opens with empty fields, placeholders and today as the due date', async () => {
    mockApi(existing);
    const dialog = await openModal();
    const title = within(dialog).getByLabelText('כותרת');
    const description = within(dialog).getByLabelText('תיאור');
    const dueDate = within(dialog).getByLabelText('תאריך יעד');
    expect(title).toHaveValue('');
    expect(title).toHaveAttribute('placeholder', messages.titlePlaceholder);
    expect(description).toHaveValue('');
    expect(description).toHaveAttribute('placeholder', messages.descriptionPlaceholder);
    expect(dueDate).toHaveAttribute('type', 'date');
    expect(dueDate).toHaveValue('2026-10-25');
    expect(dueDate).toHaveAttribute('min', '2026-10-25');
  });

  it('creates a task with a title only, appends it, closes and selects it', async () => {
    const fetchMock = mockApi(existing);
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'משימה חדשה');
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(String(postCalls(fetchMock)[0][1]!.body))).toEqual({
      title: 'משימה חדשה',
      description: '',
      dueDate: '2026-10-25',
    });
    const rows = screen.getAllByTestId('task-row');
    expect(rows.map((r) => r.textContent)).toEqual(['לקנות מצרכים', 'לתכנן חופשה', 'משימה חדשה']);
    expect(within(rows[2]).getByTestId('task-select')).toHaveAttribute('aria-pressed', 'true');
    expect(within(rows[2]).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByLabelText('כותרת')).toHaveValue('משימה חדשה');
    expect(screen.getByLabelText('תאריך יעד')).toHaveValue('2026-10-25');
  });

  it('creates a task with a description only and a cleared due date', async () => {
    const fetchMock = mockApi([]);
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('תיאור'), 'רק תיאור');
    await userEvent.clear(within(dialog).getByLabelText('תאריך יעד'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(String(postCalls(fetchMock)[0][1]!.body))).toMatchObject({ description: 'רק תיאור', dueDate: null });
    expect(screen.getByLabelText('תיאור')).toHaveValue('רק תיאור');
    expect(screen.getByLabelText('תאריך יעד')).toHaveValue('');
  });

  it('blocks empty or whitespace-only content without calling the server or clearing values', async () => {
    const fetchMock = mockApi(existing);
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), '   ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(validationMessages.content);
    expect(within(dialog).getByLabelText('כותרת')).toHaveValue('   ');
    expect(postCalls(fetchMock)).toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'x');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows length and past-date errors next to their fields', async () => {
    const fetchMock = mockApi(existing);
    const dialog = await openModal();
    const title = within(dialog).getByLabelText('כותרת');
    const description = within(dialog).getByLabelText('תיאור');
    const dueDate = within(dialog).getByLabelText('תאריך יעד');
    fireEvent.change(title, { target: { value: 'א'.repeat(101) } });
    fireEvent.change(description, { target: { value: 'ב'.repeat(2001) } });
    fireEvent.change(dueDate, { target: { value: '2026-10-24' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));

    expect(within(dialog).getByText(validationMessages.titleTooLong)).toBeInTheDocument();
    expect(within(dialog).getByText(validationMessages.descriptionTooLong)).toBeInTheDocument();
    expect(within(dialog).getByText(validationMessages.dueDateInPast)).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(dueDate).toHaveValue('2026-10-24');
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('disables the add button while sending, so a double click sends one request', async () => {
    let answer!: (r: Response) => void;
    const fetchMock = mockApi(existing, () => new Promise((resolve) => (answer = resolve)));
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'פעם אחת');
    const add = within(dialog).getByRole('button', { name: 'הוסף משימה' });
    await userEvent.dblClick(add);

    expect(add).toBeDisabled();
    for (const close of within(dialog).getAllByRole('button', { name: 'סגור' })) expect(close).toBeDisabled();
    expect(postCalls(fetchMock)).toHaveLength(1);

    answer(jsonResponse(created({ title: 'פעם אחת' }), 201));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([
    ['a full list (409)', () => jsonResponse({ error: { code: 'TASK_LIMIT_REACHED', message: 'x' } }, 409), messages.listFullOnCreate],
    ['a server error (500)', () => jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500), messages.saveFailed],
    ['too many requests (429)', () => jsonResponse({ error: { code: 'RATE_LIMITED', message: 'x' } }, 429), messages.tooManyRequests],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch')), messages.saveFailed],
  ])('keeps the modal and values on %s, and a retry succeeds', async (_name, failure, message) => {
    let calls = 0;
    mockApi(existing, async (body) => (++calls === 1 ? failure() : jsonResponse(created(body), 201)));
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'לנסות שוב');
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByLabelText('כותרת')).toHaveValue('לנסות שוב');
    const add = within(dialog).getByRole('button', { name: 'הוסף משימה' });
    expect(add).toBeEnabled();

    await userEvent.click(add);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByTestId('task-row')).toHaveLength(3);
  });

  it('shows a server validation error next to its field', async () => {
    mockApi(existing, async () =>
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: validationMessages.dueDateInPast, field: 'dueDate' } }, 422),
    );
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'הוסף משימה' }));
    expect(await within(dialog).findByText(validationMessages.dueDateInPast)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('תאריך יעד')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['the close icon', (dialog: HTMLElement) => userEvent.click(within(dialog).getAllByRole('button', { name: 'סגור' })[0])],
    ['the close button', (dialog: HTMLElement) => userEvent.click(within(dialog).getAllByRole('button', { name: 'סגור' })[1])],
    ['Esc', async (dialog: HTMLElement) => void fireEvent(dialog, new Event('cancel', { cancelable: true }))],
  ])('closing with %s discards the draft and reopening resets the form', async (_name, close) => {
    const fetchMock = mockApi(existing);
    let dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'טיוטה');
    await userEvent.clear(within(dialog).getByLabelText('תאריך יעד'));
    await close(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postCalls(fetchMock)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'הוסף משימה' }));
    dialog = screen.getByRole('dialog', { name: 'הוספת משימה' });
    expect(within(dialog).getByLabelText('כותרת')).toHaveValue('');
    expect(within(dialog).getByLabelText('תאריך יעד')).toHaveValue('2026-10-25');
  });

  it('does not close when clicking the overlay', async () => {
    mockApi(existing);
    const dialog = await openModal();
    await userEvent.type(within(dialog).getByLabelText('כותרת'), 'לא למחוק');
    await userEvent.click(dialog);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('כותרת')).toHaveValue('לא למחוק');
  });
});

describe('Add task button', () => {
  const fullList = (count: number): Task[] =>
    Array.from({ length: count }, (_, i) => ({ id: `t${i}`, title: `משימה ${i}`, description: null, dueDate: null, completed: false, position: i }));

  function renderHome() {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
  }

  // Rendering 1,000 sortable rows (and role queries over them) is slow in jsdom.
  it('is disabled with a message when the list has 1,000 tasks', async () => {
    mockApi(fullList(1000));
    renderHome();
    expect(await screen.findByText(messages.listFull)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הוסף משימה' })).toBeDisabled();
  }, 30000);

  it('is enabled with 999 tasks', async () => {
    mockApi(fullList(999));
    renderHome();
    await waitFor(() => expect(screen.getByRole('button', { name: 'הוסף משימה' })).toBeEnabled());
    expect(screen.queryByText(messages.listFull)).not.toBeInTheDocument();
  }, 30000);

  it('is disabled while loading and after a load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { code: 'X', message: 'x' } }, 500)));
    renderHome();
    expect(screen.getByRole('button', { name: 'הוסף משימה' })).toBeDisabled();
    await screen.findByText(messages.loadFailed);
    expect(screen.getByRole('button', { name: 'הוסף משימה' })).toBeDisabled();
  });
});
