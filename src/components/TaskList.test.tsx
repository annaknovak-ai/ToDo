import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import App from '../App';
import type { Task } from '../../shared/types';
import { messages } from '../messages';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

const existing: Task[] = [
  { id: ID_A, title: 'לקנות מצרכים', description: null, dueDate: null, completed: false, position: 0 },
  { id: ID_B, title: 'לתכנן חופשה', description: null, dueDate: null, completed: true, position: 1 },
  { id: ID_C, title: 'לפנות למוסך', description: null, dueDate: null, completed: false, position: 2 },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type StatusHandler = (id: string, completed: boolean) => Promise<Response>;

const echoStatus: StatusHandler = async (id, completed) =>
  jsonResponse({ ...existing.find((t) => t.id === id)!, completed });

// Routes fetch calls: GET /api/tasks returns the list; PATCH .../status goes to onStatus.
function mockApi(onStatus: StatusHandler = echoStatus) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const status = /^\/api\/tasks\/([^/]+)\/status$/.exec(url);
    if (status && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { completed: boolean };
      return onStatus(decodeURIComponent(status[1]), body.completed);
    }
    if (url === '/api/tasks' && !init?.method) return jsonResponse(existing);
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findAllByTestId('task-row');
}

const rowOf = (title: string) => screen.getAllByTestId('task-row').find((r) => r.textContent === title)!;
const checkboxOf = (title: string) => within(rowOf(title)).getByRole('checkbox');
const rowTitles = () => screen.getAllByTestId('task-row').map((r) => r.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('completion checkbox', () => {
  it('marks a task completed and back, sending the explicit value, without moving it', async () => {
    const fetchMock = mockApi();
    await renderHome();

    await userEvent.click(checkboxOf('לקנות מצרכים'));
    expect(checkboxOf('לקנות מצרכים')).toBeChecked();
    expect(rowOf('לקנות מצרכים')).toHaveClass('is-completed');
    await waitFor(() => expect(checkboxOf('לקנות מצרכים')).toBeEnabled());

    await userEvent.click(checkboxOf('לתכנן חופשה'));
    await waitFor(() => expect(checkboxOf('לתכנן חופשה')).toBeEnabled());
    expect(checkboxOf('לתכנן חופשה')).not.toBeChecked();
    expect(rowOf('לתכנן חופשה')).not.toHaveClass('is-completed');

    const statusCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/status'));
    expect(statusCalls.map(([url, init]) => [url, init?.body])).toEqual([
      [`/api/tasks/${ID_A}/status`, JSON.stringify({ completed: true })],
      [`/api/tasks/${ID_B}/status`, JSON.stringify({ completed: false })],
    ]);
    expect(rowTitles()).toEqual(['לקנות מצרכים', 'לתכנן חופשה', 'לפנות למוסך']);
  });

  it('is disabled while its request is in flight', async () => {
    let answer: (r: Response) => void = () => {};
    mockApi(() => new Promise((resolve) => (answer = resolve)));
    await renderHome();

    await userEvent.click(checkboxOf('לקנות מצרכים'));
    expect(checkboxOf('לקנות מצרכים')).toBeDisabled();
    expect(checkboxOf('לפנות למוסך')).toBeEnabled();

    answer(jsonResponse({ ...existing[0], completed: true }));
    await waitFor(() => expect(checkboxOf('לקנות מצרכים')).toBeEnabled());
    expect(checkboxOf('לקנות מצרכים')).toBeChecked();
  });

  it('puts the previous value back and shows a message when saving fails', async () => {
    mockApi(async () => jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500));
    await renderHome();

    await userEvent.click(checkboxOf('לתכנן חופשה'));
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.statusFailed);
    expect(checkboxOf('לתכנן חופשה')).toBeChecked();
    expect(screen.queryByRole('button', { name: messages.refreshList })).not.toBeInTheDocument();
  });

  it('says the task no longer exists on a 404', async () => {
    mockApi(async () => jsonResponse({ error: { code: 'TASK_NOT_FOUND', message: 'x' } }, 404));
    await renderHome();

    await userEvent.click(checkboxOf('לקנות מצרכים'));
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.taskGone);
    expect(checkboxOf('לקנות מצרכים')).not.toBeChecked();
  });

  it('keeps an unsaved draft of the selected task, and does not save it', async () => {
    const fetchMock = mockApi();
    await renderHome();

    await userEvent.click(within(rowOf('לקנות מצרכים')).getByTestId('task-select'));
    const title = screen.getByLabelText('כותרת');
    await userEvent.clear(title);
    await userEvent.type(title, 'טיוטה שלא נשמרה');

    await userEvent.click(checkboxOf('לקנות מצרכים'));
    await waitFor(() => expect(checkboxOf('לקנות מצרכים')).toBeEnabled());

    expect(screen.getByLabelText('כותרת')).toHaveValue('טיוטה שלא נשמרה');
    expect(fetchMock.mock.calls.some(([url]) => url === `/api/tasks/${ID_A}`)).toBe(false);
  });
});

describe('drag handle', () => {
  it('each row has a handle, and clicking it neither selects the task nor toggles it', async () => {
    const fetchMock = mockApi();
    await renderHome();

    const handles = screen.getAllByRole('button', { name: 'גרור כדי לשנות את הסדר' });
    expect(handles).toHaveLength(3);

    await userEvent.click(within(rowOf('לקנות מצרכים')).getByTestId('drag-handle'));
    expect(screen.getByText(messages.noSelection)).toBeInTheDocument();
    expect(checkboxOf('לקנות מצרכים')).not.toBeChecked();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method)).toBe(false);
  });

  it('the row shows the label, then the checkbox, then the handle (right to left)', async () => {
    mockApi();
    await renderHome();
    const children = Array.from(rowOf('לקנות מצרכים').children);
    expect(children.map((c) => c.getAttribute('data-testid') ?? c.getAttribute('type'))).toEqual([
      'task-select',
      'checkbox',
      'drag-handle',
    ]);
  });
});
