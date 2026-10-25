import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiError } from '../shared/types.js';

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function sendError(res: VercelResponse, status: number, code: string, message: string): void {
  const body: ApiError = { error: { code, message } };
  sendJson(res, status, body);
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
