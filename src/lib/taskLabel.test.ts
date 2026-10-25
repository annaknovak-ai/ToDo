import { taskLabel } from './taskLabel';

describe('taskLabel', () => {
  it('returns the title when present', () => {
    expect(taskLabel({ title: 'לקנות מצרכים', description: 'חלב' })).toBe('לקנות מצרכים');
  });

  it('falls back to the description when there is no title', () => {
    expect(taskLabel({ title: null, description: 'לבדוק אפשרויות ביטוח' })).toBe('לבדוק אפשרויות ביטוח');
  });

  it('collapses line breaks and repeated spaces in the description', () => {
    expect(taskLabel({ title: null, description: 'שורה ראשונה\n\nשורה   שנייה' })).toBe('שורה ראשונה שורה שנייה');
  });
});
