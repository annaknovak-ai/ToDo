import type { ApiError, Task, TaskInput } from '../../shared/types';

// A non-2xx answer from the API, with the error details from the body when present.
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;

  constructor(status: number, details?: ApiError['error']) {
    super(details?.message ?? `HTTP ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = details?.code;
    this.field = details?.field;
  }
}

async function errorFrom(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as Partial<ApiError>;
    return new ApiRequestError(response.status, body.error);
  } catch {
    return new ApiRequestError(response.status);
  }
}

// Loads the shared task list from the server. Throws on any failure.
export async function listTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response');
  return data as Task[];
}

// Creates a task at the end of the list. Throws ApiRequestError on an error answer,
// or the fetch error when the network fails.
export async function createTask(input: TaskInput): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Task;
}

// Saves the title, description and due date of a task. Throws like createTask.
export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Task;
}

// Deletes a task. The server answers 204 with no body. Throws like createTask.
export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) throw await errorFrom(response);
}

// Saves whether a task is completed (an explicit value, not a toggle). Throws like createTask.
export async function setTaskStatus(id: string, completed: boolean): Promise<Task> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Task;
}

// Saves the order of the whole list; orderedIds must hold every task id the client knows.
// Answers with the list in its new order. Throws like createTask (409 when the list changed).
export async function saveTaskOrder(orderedIds: string[]): Promise<Task[]> {
  const response = await fetch('/api/tasks/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as Task[];
}
