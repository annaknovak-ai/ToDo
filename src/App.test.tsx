import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import App from './App';
import type { Task } from '../shared/types';
import { messages } from './messages';

const sampleTasks: Task[] = [
  { id: 'a', title: 'לקנות מצרכים', description: null, dueDate: null, completed: false, position: 0 },
  {
    id: 'b',
    title: 'לתכנן חופשה',
    description: 'לבדוק יעדים, מחירים ולסגור סיסיים',
    dueDate: '2026-11-28',
    completed: false,
    position: 1,
  },
  { id: 'c', title: 'לסיים דוח שנתי', description: null, dueDate: null, completed: true, position: 2 },
  { id: 'd', title: null, description: 'לבדוק אפשרויות\nביטוח לרכב', dueDate: null, completed: false, position: 3 },
];

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Home page', () => {
  it('shows the loading message while tasks load', () => {
    mockFetch(() => new Promise(() => {}));
    renderAt('/');
    expect(screen.getByText(messages.loading)).toBeInTheDocument();
  });

  it('shows the empty state for an empty list', async () => {
    mockFetch(() => jsonResponse([]));
    renderAt('/');
    expect(await screen.findByText(messages.emptyList)).toBeInTheDocument();
    expect(screen.getByText(messages.noSelection)).toBeInTheDocument();
  });

  it('shows a load error and never the empty state when the request fails', async () => {
    mockFetch(() => jsonResponse({ error: { code: 'X', message: 'x' } }, 500));
    renderAt('/');
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.loadFailed);
    expect(screen.queryByText(messages.emptyList)).not.toBeInTheDocument();
  });

  it('shows a load error when the network fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    renderAt('/');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(messages.emptyList)).not.toBeInTheDocument();
  });

  it('lists tasks in server order with title or description fallback', async () => {
    mockFetch(() => jsonResponse(sampleTasks));
    renderAt('/');
    const rows = await screen.findAllByTestId('task-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'לקנות מצרכים',
      'לתכנן חופשה',
      'לסיים דוח שנתי',
      'לבדוק אפשרויות ביטוח לרכב',
    ]);
  });

  it('marks completed tasks visually', async () => {
    mockFetch(() => jsonResponse(sampleTasks));
    renderAt('/');
    const rows = await screen.findAllByTestId('task-row');
    expect(rows[2]).toHaveClass('is-completed');
    expect(within(rows[2]).getByRole('checkbox')).toBeChecked();
    expect(rows[0]).not.toHaveClass('is-completed');
    expect(within(rows[0]).getByRole('checkbox')).not.toBeChecked();
  });

  it('starts with no selection and shows details of the clicked task', async () => {
    mockFetch(() => jsonResponse(sampleTasks));
    renderAt('/');
    await screen.findAllByTestId('task-row');
    expect(screen.getByText(messages.noSelection)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'לתכנן חופשה' }));
    expect(screen.queryByText(messages.noSelection)).not.toBeInTheDocument();
    expect(screen.getByLabelText('כותרת')).toHaveValue('לתכנן חופשה');
    expect(screen.getByLabelText('תיאור')).toHaveValue('לבדוק יעדים, מחירים ולסגור סיסיים');
    expect(screen.getByLabelText('תאריך יעד')).toHaveValue('2026-11-28');
    expect(screen.getByRole('button', { name: 'לתכנן חופשה' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'לקנות מצרכים' }));
    expect(screen.getByLabelText('כותרת')).toHaveValue('לקנות מצרכים');
    expect(screen.getByLabelText('תיאור')).toHaveValue('');
    expect(screen.getByLabelText('תאריך יעד')).toHaveValue('');
  });

  it('does not offer write actions yet', async () => {
    mockFetch(() => jsonResponse(sampleTasks));
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'לקנות מצרכים' }));
    expect(screen.queryByRole('button', { name: /שמור|מחק|הוסף/ })).not.toBeInTheDocument();
  });
});

describe('Navigation', () => {
  it('moves between home and about and marks the active link', async () => {
    mockFetch(() => jsonResponse([]));
    renderAt('/');
    expect(screen.getByRole('link', { name: 'דף הבית' })).toHaveClass('active');

    await userEvent.click(screen.getByRole('link', { name: 'אודות' }));
    expect(screen.getByRole('heading', { level: 1, name: 'אודות' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'אודות' })).toHaveClass('active');

    await userEvent.click(screen.getByRole('link', { name: 'דף הבית' }));
    expect(screen.getByRole('heading', { level: 1, name: 'המשימות שלי' })).toBeInTheDocument();
  });

  it('renders the about page directly', () => {
    renderAt('/about');
    expect(screen.getByRole('heading', { level: 1, name: 'אודות' })).toBeInTheDocument();
  });
});
