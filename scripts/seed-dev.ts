// Inserts sample tasks into the Dev database, only when the table is empty.
import { createDevPool, insertTask } from '../tests/helpers/devDb.js';

const samples = [
  { title: 'לקנות מצרכים', description: 'חלב, לחם, ביצים וירקות' },
  { title: 'לתכנן חופשה', description: 'לבדוק יעדים, מחירים ולסגור טיסות', dueDate: '2026-12-15' },
  { title: 'לסיים דוח שנתי', completed: true },
  { title: 'לפנות למוסך', dueDate: '2026-11-10' },
  { title: null, description: 'לבדוק אפשרויות ביטוח לרכב לפני שהפוליסה הנוכחית מסתיימת בסוף החודש הבא' },
  { title: 'להתקשר לרופא', description: 'לקבוע תור לבדיקה שנתית' },
];

const db = createDevPool();
try {
  const { rows } = await db.query<{ count: string }>('select count(*) from public.tasks');
  if (Number(rows[0].count) > 0) {
    console.log(`The tasks table already has ${rows[0].count} tasks; nothing was added.`);
  } else {
    for (const [position, sample] of samples.entries()) {
      await insertTask(db, { ...sample, position });
    }
    console.log(`Added ${samples.length} sample tasks.`);
  }
} finally {
  await db.end();
}
