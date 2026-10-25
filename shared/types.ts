// A task as returned by the API. dueDate is a plain date string (YYYY-MM-DD).
export type Task = {
  id: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  position: number;
};

// The editable fields of a task, as sent when creating it.
export type TaskInput = {
  title: string | null;
  description: string | null;
  dueDate: string | null;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};
