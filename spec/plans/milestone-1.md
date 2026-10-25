# תוכנית – Milestone 1: יסודות המערכת וצפייה ברשימה משותפת

**מקורות:** `MILESTONES.md` (Milestone 1), `PRD.md`, `ARCHITECTURE.md` (כולל ADR-1 עד ADR-11), `DESIGN.md` והתמונות ב-`spec/`.
**מצב נוכחי:** ב-Repository יש רק מסמכי spec. ה-Repository המקומי כבר מחובר ל-`https://github.com/annaknovak-ai/ToDo.git`.

## 1. מטרה והיקף

Slice ראשון מקצה לקצה: אתר React (שני דפים, RTL, Responsive) שקורא רשימת משימות מ-Supabase PostgreSQL דרך Vercel Function אחת (`GET /api/tasks`), ומציג פרטי משימה נבחרת לקריאה בלבד. בנוסף: Migrations, הפרדת סביבות Dev/Production והכנת הפריסה האוטומטית.

**בתוך ההיקף:** כל סעיפי "מה יש לממש" ב-Milestone 1.

**מחוץ להיקף (שייך ל-Milestones הבאים) – לא ייבנה ולא יוצג כאילו עובד:**
- כפתור **הוסף משימה** ו-Modal (M2). הכפתור **לא יוצג** ב-M1, כדי לא להציג פעולת כתיבה שאינה עובדת.
- שדות פרטים ניתנים לעריכה, **שמור שינויים**, **מחק משימה** (M3). ב-M1 השדות מוצגים כ-`readOnly`, בלי כפתורים.
- Checkbox פעיל וידית גרירה (M4). ב-M1 ה-Checkbox מוצג במצב `disabled` רק כחיווי להשלמה; ידית הגרירה **לא תוצג**.
- `shared/validation.ts`, Rate Limiting, נעילות, Manifest/PWA, הודעת Offline קבועה (M2–M5).

## 2. צעדים שהמשתמש מבצע בעצמו (בהדרכה, בשפה פשוטה)

הבנייה תיעצר בנקודות האלה ותדריך צעד-אחר-צעד. Claude אינו יוצר חשבונות ואינו מזין סיסמאות.

### 2.1 במהלך הבנייה (לפני חיבור למסד)
1. **Supabase:** פתיחת חשבון (Free) ושני פרויקטים: `todo-dev` ו-`todo-prod`. אזור ברירת מחדל מוצע: **Central EU (Frankfurt)** – הקרוב לישראל מבין האזורים הנפוצים. בעת היצירה: **לכבות את ה-Data API** (ADR-2). את סיסמאות ה-`postgres` שומרים במנהל סיסמאות.
2. **משתמש מסד ב-Dev:** ב-SQL Editor של `todo-dev` מריצים `create user app_backend with password '<סיסמה שבוחרים>';` (ADR-2). ב-Production זה ייעשה בשלב הדחיפה (סעיף 2.2).
3. **Supabase CLI מול Dev בלבד:** בטרמינל של הפרויקט: `npx supabase login`, ואז `npx supabase link --project-ref <ref של todo-dev>` (מזינים את סיסמת ה-`postgres` של Dev). ה-CLI לעולם לא יקושר ל-Production.
4. **`.env`:** Claude יוצר `.env.example` ומעתיק פעם אחת ל-`.env`. המשתמש ממלא את `DATABASE_URL` – כתובת ה-**Transaction Pooler** של Dev (פורט `6543`), עם המשתמש `app_backend.<ref של todo-dev>` והסיסמה שלו, **בלי** הפרמטר `sslmode` (ההצפנה מוגדרת בקוד, ADR-3).
5. **Vercel:** פתיחת חשבון Hobby (הרשמה עם GitHub), ואז בטרמינל `npx vercel login` ו-`npx vercel link` (יצירת פרויקט חדש בשם `todo`). זה נדרש כדי ש-`vercel dev` ירוץ מקומית. חיבור ה-GitHub וההגדרות של Production ייעשו רק בשלב הדחיפה.

### 2.2 בשלב הדחיפה (רק אחרי שהמשתמש בדק ואישר את האתר המקומי)
לפני ה-Push Claude עוצר ומסביר מה ייווצר במסד של האתר החי (טבלת `tasks` והרשאות), ודוחף רק באישור מפורש (ARCHITECTURE 2.9).
1. **משתמש מסד ב-Production:** אותה פקודת `create user app_backend ...` ב-SQL Editor של `todo-prod`, עם סיסמה **אחרת**. חובה לפני ה-Push – אחרת ה-Migration (שמעניקה הרשאות ל-`app_backend`) תיכשל.
2. **Supabase GitHub Integration** בפרויקט `todo-prod`: חיבור ל-Repository `annaknovak-ai/ToDo` בלבד, תיקיית Supabase: `supabase`, הפעלת **Deploy to production** לענף `main`, ללא Automatic Branching (ADR-1).
3. **Vercel:** ב-Settings → Git חיבור ה-Repository; ב-Environment Variables הוספת `DATABASE_URL` של **Production** (Pooler של `todo-prod`, משתמש `app_backend.<ref של todo-prod>`) **לסביבת Production בלבד** – לא ל-Preview ולא ל-Development.
4. Push ל-`main` ← בדיקת ה-Deployment ב-Vercel, בדיקה ב-Supabase שה-Migration הוחלה על `todo-prod`, ובדיקות **קריאה בלבד** מול האתר החי (טעינה, ניווט, Refresh ב-`/about`, `GET /api/tasks` מחזיר `[]`).

## 3. מבנה הקבצים ליצירה

```text
package.json, package-lock.json
index.html                      # lang="he" dir="rtl", theme-color
vite.config.ts
vercel.json                     # framework, SPA fallback, regions
tsconfig.json (+ tsconfig.app.json, tsconfig.node.json, tsconfig.api.json)
vitest.config.ts, playwright.config.ts
.env.example                    # DATABASE_URL= (ללא ערך)
api/
  tasks/index.ts                # GET /api/tasks
server/
  db.ts                         # pg Pool (module-level, max 1, ssl, timeouts, date parser)
  tasksRepository.ts            # listTasks(): SQL ordered by position, id
  http.ts                       # sendError / method guard / JSON helpers
shared/
  types.ts                      # Task type shared by client and server
src/
  main.tsx, App.tsx             # Router + layout
  messages.ts                   # Hebrew UI strings, verbatim from PRD 4.ג
  api/tasksApi.ts               # fetch wrapper for /api/tasks
  lib/taskLabel.ts              # title, or description as one line
  components/NavBar.tsx, TaskList.tsx, TaskRow.tsx, TaskDetails.tsx
  pages/HomePage.tsx, AboutPage.tsx
  styles.css                    # design tokens + layout + components
supabase/
  config.toml                   # from `npx supabase init` (no Docker needed)
  migrations/<timestamp>_create_tasks.sql
scripts/
  seed-dev.ts                   # inserts sample tasks into Dev only if table is empty
tests/
  helpers/devDbSnapshot.ts      # snapshot/restore of Dev tasks (ADR-7, ADR-11)
  unit + component tests next to code (*.test.ts / *.test.tsx)
  api/tasks.integration.test.ts
  e2e/home.spec.ts, e2e/navigation.spec.ts
```

## 4. התקנה ותלויות

- Node 24 (מותקן מקומית: v24.22.0); `"engines": {"node": "24.x"}` ו-`"type": "module"`.
- **Dependencies:** `react`, `react-dom`, `react-router`, `pg`, `@fontsource-variable/inter`.
- **devDependencies:** `typescript`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/pg`, `@types/node`, `@vercel/node`, `vercel`, `supabase` (ADR-4), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test` (ADR-11), `tsx` (להרצת סקריפט ה-Seed), `dotenv`, `cross-env`.
- `postinstall`: התקנת Chromium לתוך `node_modules` עם `PLAYWRIGHT_BROWSERS_PATH=0` (ADR-11). כל סקריפט שמריץ Playwright מגדיר את אותו משתנה (באמצעות `cross-env`).
- גרסאות Major מקובעות ב-`package.json`, Lockfile ב-Git.
- שום התקנה גלובלית ושום Docker.

**Scripts ב-`package.json`:**
| Script | פעולה |
|---|---|
| `dev` | `vercel dev` (Frontend + API יחד, מול Dev) |
| `build` | `tsc -b && vite build` |
| `typecheck` | בדיקת טיפוסים ל-`src`, `api`, `server`, `shared` |
| `test` | `vitest run` (Unit + Component, ללא Database) |
| `test:integration` | בדיקות `*.integration.test.ts` מול Dev בלבד |
| `test:e2e` | Playwright מול `vercel dev` ו-Dev, Desktop Chrome + Mobile Chrome |
| `seed:dev` | הזנת נתוני בדיקה ל-Dev (רק אם הטבלה ריקה) |
| `db:push` | `supabase db push` (מול הפרויקט המקושר – Dev) |

## 5. מסד הנתונים – Migration

קובץ אחד: `supabase/migrations/<timestamp>_create_tasks.sql`. הקובץ כתוב כך שהרצה חוזרת שלו בטוחה (`if not exists`, `drop policy if exists` לפני `create policy`), כדי לעמוד ב"ניתנות להרצה מחדש על Dev".

תוכן:
- `create table if not exists public.tasks` עם העמודות בדיוק לפי ARCHITECTURE 2.3: `id uuid primary key default gen_random_uuid()`, `title varchar(100)`, `description varchar(2000)`, `due_date date`, `completed boolean not null default false`, `position integer not null`, `created_at`/`updated_at timestamptz not null default now()`.
- Constraint תוכן: `(title ~ '\S') or (description ~ '\S')` – לפחות אחד מהם מכיל תו שאינו White Space (`NULL` נחשב לא תקין).
- Constraint `position >= 0`; אינדקס על `(position, id)`; **בלי** UNIQUE על `position`.
- הרשאות (ADR-2): `grant usage on schema public to app_backend`; `grant select, insert, update, delete on public.tasks to app_backend`; `revoke all on public.tasks from anon, authenticated`; `alter table public.tasks enable row level security`; Policy `for all to app_backend using (true) with check (true)`.
- אין Trigger ל-`updated_at`: לפי ADR-8 ה-`UPDATE` עצמו יעדכן אותו (M3).

החלה: `npm run db:push` מול Dev בלבד. אימות: הרצה חוזרת של `db:push` מדווחת שאין מה להחיל; בדיקת ההרשאות על ידי חיבור כ-`app_backend` (בדיקות ה-Integration).

**נתוני בדיקה:** `scripts/seed-dev.ts` טוען את `DATABASE_URL` מ-`.env` ומכניס כ-6 משימות לדוגמה (לפי ה-Wireframes: "לקנות מצרכים", "לתכנן חופשה" עם תיאור ותאריך, "לסיים דוח שנתי" כהושלמה, "לפנות למוסך", משימה **ללא כותרת** עם תיאור ארוך – לבדיקת הקיצור), **רק אם הטבלה ריקה**, כך שאינו דורס נתונים שהמשתמש הזין. הסקריפט מסרב לרוץ אם `NODE_ENV=production` או `VERCEL_ENV` מוגדר.

## 6. Backend – `GET /api/tasks`

**`server/db.ts`**
- `pg.Pool` ברמת המודול (נוצר פעם אחת לכל Function Instance): `connectionString: process.env.DATABASE_URL`, `max: 1`, `ssl: { rejectUnauthorized: false }` (ADR-3), `connectionTimeoutMillis` ~5s, `idleTimeoutMillis` ~10s, `query_timeout`/`statement_timeout` ~10s.
- אם הכתובת כוללת `sslmode`, להסיר אותו לפני היצירה (בגרסאות `pg` עדכניות הוא דורס את הגדרת ה-`ssl` ומפעיל אימות תעודה מלא, שייכשל – ADR-3).
- **Type parser ל-`date` (OID 1082) שמחזיר מחרוזת `YYYY-MM-DD`** כפי שהיא – אחרת `pg` ממיר ל-`Date` באזור הזמן של השרת וזה עלול להזיז יום (ARCHITECTURE 2.3: אין להסתמך על שעון מכונת ה-Serverless).
- בלי Named Prepared Statements (Pooler במצב Transaction).

**`server/tasksRepository.ts`** – `listTasks()`: `select id, title, description, due_date, completed, position from public.tasks order by position asc, id asc`, ומיפוי ל-`Task` (`dueDate` במקום `due_date`; `created_at`/`updated_at` אינם נחשפים).

**`shared/types.ts`** – `Task = { id: string; title: string | null; description: string | null; dueDate: string | null; completed: boolean; position: number }`.

**`api/tasks/index.ts`**
- `GET` בלבד; Method אחר ← `405` עם `Allow: GET` ו-`{error:{code:'METHOD_NOT_ALLOWED', message}}`.
- הצלחה ← `200`, מערך (גם ריק), `Cache-Control: no-store`.
- כשל במסד ← `503` (חיבור/Timeout) או `500`, עם `{error:{code, message}}` בעברית, בלי פרטי SQL או סודות; רישום ללוג של סוג השגיאה בלבד, לא של תוכן המשימות.
- ה-Handler מקבל את ה-Repository באמצעות פרמטר/Factory פשוט כדי שאפשר יהיה לבדוק אותו ב-Unit Test בלי Database.

**תשומת לב לבנייה:** עם `"type": "module"`, ייבואים יחסיים בקוד `api/`, `server/`, `shared/` נכתבים עם סיומת `.js` (דרישת Node ESM בזמן ריצה ב-Vercel). יש לוודא שהפונקציה רצה גם ב-`vercel dev` וגם ב-Build של Vercel.

## 7. Vercel ו-Hosting

`vercel.json`:
- `"framework": "vite"` (כדי ש-`vercel dev` יפעיל את Vite ולא את `npm run dev` ברקורסיה).
- `rewrites`: `{ "source": "/((?!api/).*)", "destination": "/index.html" }` – SPA fallback ל-`/about` (קבצים סטטיים קיימים מוגשים לפני ה-Rewrite, ו-`/api/*` אינו נכלל).
- `"regions": ["fra1"]` – קרוב ל-Supabase Frankfurt (אם המשתמש בוחר אזור אחר ב-Supabase, מעדכנים בהתאם).

אין `VITE_*` משתנים ואין שום ערך של מסד הנתונים בקוד הלקוח. `vercel dev` טוען את `.env` המקומי; לא מוגדרים משתני Development/Preview ב-Vercel.

## 8. Frontend

**`index.html`:** `<html lang="he" dir="rtl">`, `<title>`, `<meta name="viewport">`, `theme-color` `#2F80ED`.

**ניווט (`App.tsx`, `NavBar.tsx`):** `BrowserRouter` עם `/` ← `HomePage`, `/about` ← `AboutPage`, ונתיב לא קיים ← הפניה ל-`/`. סרגל עליון עם שני `NavLink` בלבד: **דף הבית**, **אודות**; הפריט הפעיל מסומן (כחול/רקע עדין). אין אייקון המבורגר (DESIGN 1.6).

**`HomePage`** – State ב-Hooks בלבד:
- `status: 'loading' | 'ready' | 'error'`, `tasks: Task[]`, `selectedId: string | null` (תמיד `null` בטעינה).
- טעינה ב-`useEffect` דרך `tasksApi.listTasks()` (`fetch('/api/tasks', { cache: 'no-store' })`); תשובה שאינה `ok` או JSON שאינו מערך ← `error`.
- כותרת H1 **המשימות שלי**; אזור **רשימת משימות** (מימין בדסקטופ) ואזור **פרטי משימה** (משמאל).
- מצבי הרשימה, בנוסחים מ-`PRD.md` (`src/messages.ts`):
  - טעינה: **טוען משימות...**
  - שגיאה: **לא הצלחנו לטעון את המשימות. בדוק את החיבור לאינטרנט ורענן את הדף.** – ואם `navigator.onLine === false`: **אין חיבור לאינטרנט. לא ניתן לצפות במשימות או לשנות אותן עד שהחיבור יחזור.** שגיאה **לעולם** אינה מציגה את הודעת הרשימה הריקה.
  - ריקה: **אין עדיין משימות. לחץ על "הוסף משימה" כדי להתחיל.** (הנוסח מה-PRD; הכפתור עצמו יתווסף ב-M2.)

**`TaskRow`:** שורה עם Checkbox `disabled` (מסומן כשהמשימה הושלמה) וטקסט מזהה בתוך `button` לבחירה (נגיש במקלדת). משימה שהושלמה: Checkbox מסומן + טקסט חצוי (`line-through`, צבע `text-secondary`). שורה נבחרת: רקע תכלת עדין + `aria-current`/`aria-pressed`.

**`taskLabel`:** אם יש כותרת – הכותרת; אחרת התיאור, כשירידות שורה ורווחים מרובים מוחלפים ברווח יחיד. הקיצור חזותי ב-CSS (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`) – לפי רוחב המסך, בלי מספר תווים קבוע (PRD, הנחות יישום).

**`TaskDetails`:**
- ללא בחירה: **בחר משימה מהרשימה כדי לצפות בפרטיה** (גם כשהרשימה ריקה).
- עם בחירה: תוויות **כותרת**, **תיאור**, **תאריך יעד** ושדות `readOnly` (`input`, `textarea`, `input type="date"`) עם ערכי המשימה; שדה ריק כשהערך חסר. אין כפתורים.
- **מובייל:** בבחירת משימה, אם רוחב המסך צר (אותה נקודת שבירה של ה-CSS, דרך `matchMedia`), אזור הפרטים נגלל לתצוגה (`scrollIntoView`).

**`AboutPage`:** H1 **אודות** ופסקה קצרה, לפי נוסח ה-Wireframe: "זהו אתר TODO List משותף ופשוט, המאפשר ליצור, לצפות, לעדכן, לסמן כהושלמו, לסדר מחדש ולמחוק משימות משותפות." ובנוסף משפט על כך שאין צורך בהתחברות והרשימה משותפת לכל המבקרים (DESIGN 1.5).

**אין שימוש ב-Local Storage / Session Storage / IndexedDB** לנתוני משימות.

## 9. עיצוב (בסיס בלבד; הליטוש המלא ב-M5)

`src/styles.css`:
- **Tokens** כ-CSS Variables, בדיוק לפי DESIGN 2.1 (`--primary #2F80ED`, `--primary-light #56CCF2`, `--background #EAF6FF`, `--surface #FFFFFF`, `--text-primary #1F2937`, `--text-secondary #6B7280`, `--border #D1D5DB`, `--input-background #F3F4F6`, `--success`, `--error`, `--warning`), רדיוס 8–16px, צל `0 2px 8px rgba(0,0,0,0.08)`, מרווחים בכפולות 8px.
- **גופנים (ADR-4):** `@fontsource-variable/inter` נטען מקומית; `font-family: "Inter Variable", "Segoe UI", Roboto, "Noto Sans Hebrew", Arial, sans-serif`. גדלים לפי DESIGN 2.2 (H1 32/Bold, H2 24/Bold, H3 18/Semibold, Body 16/14/12).
- **דסקטופ (≥ 768px):** Header למעלה; מתחתיו אזור עבודה ב-Grid של שתי עמודות שממלא את גובה המסך (`100dvh` פחות ה-Header). כל אזור הוא כרטיס לבן עם כותרת אזור (H3). אזור הרשימה בלבד נגלל (`overflow-y: auto`); אזור הפרטים נשאר גלוי. סדר ב-DOM: רשימה ואז פרטים – ב-RTL הרשימה מימין.
- **מובייל (< 768px):** עמודה אחת, רשימה מעל פרטים, גלילת דף רגילה, שדות ברוחב מלא.

## 10. בדיקות

**Unit + Component (`npm test`, ללא Database):**
- `taskLabel`: כותרת; תיאור כשאין כותרת; ירידות שורה ← רווח.
- Handler של `api/tasks` עם Repository מדומה: `200` + מערך; `[]` כשאין משימות; `Cache-Control: no-store`; `405` ל-`POST`; כשל ← `500`/`503` בלי חשיפת הודעת השגיאה המקורית.
- מיפוי שורת DB ל-`Task` (כולל `dueDate` כמחרוזת ו-`null`).
- `HomePage` (React Testing Library, `fetch` מדומה): מצב טעינה; רשימה ריקה; שגיאה **אינה** מציגה הודעת רשימה ריקה; כותרת/תיאור חלופי; Class/סימון למשימה שהושלמה; אין בחירה בהתחלה; לחיצה מציגה פרטים; מעבר בין משימות.
- `NavBar`/`App`: מעבר בין הדפים, סימון פריט פעיל.

**Integration (`npm run test:integration`, מול Dev בלבד, ADR-7):**
- `tests/helpers/devDbSnapshot.ts`: שמירת כל השורות בתחילת ההרצה והחזרתן בדיוק בסיומה (גם בכישלון, ב-`afterAll`).
- ריקון הטבלה ← `GET` מחזיר `200` ו-`[]`.
- הכנסת משימות עם `position` בסדר מעורבב ו-`position` זהה לשתיים ← הסדר המוחזר `position, id` ויציב.
- אימות ש-Constraint התוכן דוחה שורה עם כותרת ותיאור של רווחים בלבד, וש-`position` שלילי נדחה.
- החיבור כ-`app_backend` מצליח לקרוא ולכתוב (הרשאות ה-Migration).

**E2E (`npm run test:e2e`, Playwright, Desktop Chrome + Mobile Chrome, מול `vercel dev` ו-Dev, ADR-11):**
- טעינת דף הבית: הרשימה מהמסד מוצגת; אין בחירה והודעת הבחירה מוצגת; בחירה מציגה ערכים; משימה שהושלמה חצויה.
- Refresh אחרי שינוי במסד: הבדיקה מכניסה משימה ישירות למסד (עם Snapshot/Restore), מרעננת ורואה אותה.
- Local Storage ו-Session Storage אינם מכילים נתוני משימות.
- ניווט **דף הבית** ↔ **אודות**, ו-Reload ישיר ב-`/about`.
- `page.route`: תשובת `[]` ← הודעת רשימה ריקה; תשובת `500` ← הודעת שגיאה ולא רשימה ריקה; 60 משימות מדומות בדסקטופ ← רק אזור הרשימה נגלל והפרטים נשארים במסך.
- מובייל: הרשימה מעל הפרטים; בחירת משימה מביאה את אזור הפרטים לתוך ה-Viewport.

**בדיקות ידניות של Claude בסיום הבנייה (בדפדפן הפנימי, רוחב דסקטופ ומובייל):** השוואה מול ה-Wireframes, צילומי מסך, ו-`curl` ל-`/api/tasks`, `/about`, ו-Method לא נתמך.

**בדיקת סודות:** חיפוש ב-`dist/` אחרי Build של מחרוזות כמו `pooler.supabase.com`, `postgres://`, `DATABASE_URL`; `git status`/`git check-ignore .env` מוודאים ש-`.env` אינו נכנס ל-Git.

## 11. סדר הבנייה

1. אתחול הפרויקט: `package.json`, Vite + React + TS, תצורות TS, Vitest, `.gitignore` (הוספת שורות רק אם חסרות – למשל `.vercel` כבר קיים).
2. Frontend עם נתונים מדומים: ניווט, Layout, רשימה, פרטים, מצבים, CSS ו-Unit/Component tests.
3. `.env.example` ← העתקה ל-`.env`; **עצירה להדרכה** (סעיף 2.1): Supabase, `app_backend` ב-Dev, `supabase login/link`, מילוי `.env`, Vercel login/link.
4. `npx supabase init`, Migration, `npm run db:push` מול Dev, הרצה חוזרת לאימות, `npm run seed:dev`.
5. `server/`, `api/tasks/index.ts`, חיבור ה-Frontend ל-API האמיתי; `vercel.json`.
6. Integration + E2E (כולל התקנת Chromium ב-`postinstall`).
7. בדיקה עצמית מלאה מול ה-Definition of Done; תיקונים.
8. עדכון `CLAUDE.md` ← **פקודות הרצה** (`npm run dev`, `npm test`, `npm run test:integration`, `npm run test:e2e`); תיעוד ADR-12 ואילך להחלטות טכניות חדשות (לפחות: בחירת אזור Frankfurt/`fra1`, ו-Type parser לתאריכים); סימון 🟡 ליד Milestone 1 ב-`MILESTONES.md`; סגירת ההרצה. ללא commit.

## 12. מיפוי ל-Definition of Done

| תנאי | איך נבדק |
|---|---|
| `GET /api/tasks` בסדר קבוע; ריק ← `[]` | Unit + Integration מול Dev |
| כותרת / תיאור מקוצר; הושלמה מובחנת | Component + E2E + צילום מסך |
| אין בחירה בכניסה; בחירה מציגה פרטים; שגיאה ≠ רשימה ריקה | Component + E2E (`page.route` 500) |
| ניווט ו-Refresh ב-`/about` | E2E + `curl` |
| מבנה תואם Wireframes בדסקטופ ובמובייל, גלילות, צבעים וגופנים | E2E (Viewport/גלילה) + השוואה ידנית לצילומי מסך |
| Refresh מחזיר נתונים עדכניים; ללא Local Storage | E2E |
| אין סודות בקוד לקוח/Git; Migrations מתועדות, הוחלו על Dev וניתנות להרצה חוזרת | חיפוש ב-`dist`, `git check-ignore`, `db:push` חוזר |
| רץ מקומית מול Dev; Production אינו בשימוש | `.env` מכיל Dev בלבד (המשתמש ממלא); CLI מקושר ל-Dev |
| Push ← Deployment תקין ו-Migrations על Production | **ממתין לדחיפה** – נבדק מיד אחריה (סעיף 2.2), תיקונים שייכים ל-M1 |

## 13. סיכונים ונקודות לתשומת לב

- **Migration ב-Production לפני שנוצר `app_backend`** תיכשל – לכן יצירת המשתמש ב-`todo-prod` היא תנאי לדחיפה.
- **Supabase Free:** שני הפרויקטים מנצלים את המכסה; פרויקט שלא היה בשימוש עלול להיעצר (Restore מלוח הבקרה).
- **ESM ב-Vercel Functions** (סיומות `.js` בייבואים) ו-**`sslmode` בכתובת החיבור** – שתי תקלות נפוצות; נבדקות ב-`vercel dev` ובפריסה הראשונה.
- הרצה ראשונה של `npm install` מורידה כ-150MB (Chromium).
- בזמן הרצת Integration/E2E הרשימה ב-Dev משתנה זמנית ומוחזרת בסיום.
