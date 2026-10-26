import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiError } from '../shared/types.js';
import type { ValidationErrors, ValidationField } from '../shared/validation.js';

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function sendError(res: VercelResponse, status: number, code: string, message: string, field?: string): void {
  const body: ApiError = { error: field ? { code, message, field } : { code, message } };
  sendJson(res, status, body);
}

// Order in which a single validation error is reported.
const FIELD_ORDER: ValidationField[] = ['content', 'title', 'description', 'dueDate'];

// Responds with 422 and the first validation error, naming its field.
export function sendValidationError(res: VercelResponse, errors: ValidationErrors): void {
  const field = FIELD_ORDER.find((f) => errors[f])!;
  sendError(res, 422, 'VALIDATION_ERROR', errors[field]!, field);
}

// Responds with 400/413 and returns false unless the request carries a JSON body within the size limit.
export function requireJsonBody(req: VercelRequest, res: VercelResponse, maxBytes: number): boolean {
  const contentType = String(req.headers?.['content-type'] ?? '');
  if (!/^application\/json\b/i.test(contentType)) {
    sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
    return false;
  }
  const length = Number(req.headers?.['content-length'] ?? 0);
  if (length > maxBytes || Buffer.byteLength(JSON.stringify(req.body ?? null)) > maxBytes) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'הבקשה גדולה מדי.');
    return false;
  }
  return true;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export const TASK_NOT_FOUND_MESSAGE = 'המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה.';

// Returns the :id route parameter, or responds with 400 and returns null when it is not a UUID.
export function requireTaskId(req: VercelRequest, res: VercelResponse): string | null {
  const id = req.query?.id;
  if (isUuid(id)) return id;
  sendError(res, 400, 'INVALID_REQUEST', 'הבקשה אינה תקינה.');
  return null;
}

// Responds with 405 and returns false when the method is not allowed.
export function allowMethods(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  if (req.method && methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, 'METHOD_NOT_ALLOWED', 'הפעולה אינה נתמכת.');
  return false;
}

const UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '53300']);

// Maps an unexpected error to a generic response without leaking SQL or secrets.
export function sendServerError(res: VercelResponse, error: unknown): void {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : '';
  const unavailable = (code && UNAVAILABLE_CODES.has(code)) || /timeout/i.test(message);
  console.error('API error', { code: code ?? (error as Error)?.name });
  if (unavailable) {
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'השירות אינו זמין כרגע. נסה שוב בעוד רגע.');
  } else {
    sendError(res, 500, 'INTERNAL_ERROR', 'אירעה שגיאה בשרת. נסה שוב.');
  }
}
