// A task as returned by the API. dueDate is a plain date string (YYYY-MM-DD).
export type Task = {
  id: string;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  position: number;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};
