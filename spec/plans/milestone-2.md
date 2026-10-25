# תוכנית – Milestone 2: יצירת משימה באמצעות Modal

**מקורות:** `MILESTONES.md` (Milestone 2), `PRD.md` (זרימה 2, FR-02, FR-03, FR-10, טבלת מקרי קצה, נוסחי הודעות), `DESIGN.md` (1.1, 1.3, 2.3), `ARCHITECTURE.md` (2.3–2.6, ADR-5, ADR-6, ADR-7, ADR-9, ADR-11).
**מצב הקוד בפתיחה:** Milestone 1 ✅ – `GET /api/tasks`, רשימה, פרטים לקריאה בלבד, ניווט, בדיקות Unit/Integration/E2E.

## 1. מטרה והיקף

מבקר לוחץ **"הוסף משימה"**, ממלא טופס ב-Modal, והמשימה נשמרת ב-PostgreSQL בסוף הרשימה, מופיעה ברשימה ונבחרת. כולל Validation זהה בלקוח ובשרת, תקרת 1,000 משימות שנאכפת בשרת תחת נעילה, וטיפול בשגיאות.

**מחוץ להיקף (Milestones הבאים):** עריכה ושמירת פרטים, מחיקה ו-Modal אישור מחיקה (M3); Checkbox פעיל וגרירה (M4); ליטוש חזותי מלא ו-PWA (M5). אזור הפרטים נשאר לקריאה בלבד.

**אין שינוי במבנה מסד הנתונים** – אין Migration חדשה. לכן הדחיפה בסוף ה-Milestone לא תשנה את מבנה ה-Production Database.

## 2. קבצים

| קובץ | פעולה | תוכן |
|---|---|---|
| `shared/validation.ts` | חדש | כללי Validation והודעות (ADR-6), חישוב "היום" באזור זמן (ADR-5) |
| `shared/validation.test.ts` | חדש | בדיקות Unit לכללים |
| `shared/types.ts` | שינוי | `TaskInput` (`{title, description, dueDate}`) |
| `server/tasksRepository.ts` | שינוי | `createTask()` ב-Transaction עם Advisory Lock; `TaskLimitError` |
| `server/listTasksHandler.ts` → `server/tasksHandler.ts` | שינוי שם + הרחבה | Handler אחד ל-`GET` ו-`POST` על `/api/tasks` |
| `server/listTasksHandler.test.ts` → `server/tasksHandler.test.ts` | שינוי שם + הרחבה | בדיקות `POST` עם Repository מדומה |
| `server/http.ts` | שינוי | `sendError` עם `field` אופציונלי; עזר לבדיקת `Content-Type` וגודל Body |
| `api/tasks/index.ts` | שינוי | חיבור ל-`createTasksHandler` |
| `src/api/tasksApi.ts` | שינוי | `createTask()` ו-`ApiRequestError` (סטטוס + `code` + `field`) |
| `src/lib/dates.ts` | חדש | `localToday()` – התאריך המקומי של המכשיר כ-`YYYY-MM-DD` |
| `src/components/Modal.tsx` | חדש | רכיב Modal כללי (ישמש גם לאישור מחיקה ב-M3) |
| `src/components/CreateTaskModal.tsx` | חדש | טופס ההוספה |
| `src/components/CreateTaskModal.test.tsx` | חדש | בדיקות רכיב |
| `src/pages/HomePage.tsx` | שינוי | כפתור **"הוסף משימה"**, הודעת רשימה מלאה, פתיחת Modal, הוספה לרשימה ובחירה |
| `src/messages.ts` | שינוי | נוסחי הודעות חדשים (ממוקמים ב-PRD 4.ג) |
| `src/styles.css` | שינוי | כפתורים (Primary/Secondary/Disabled), Modal ו-Overlay, הודעות שגיאה בטופס |
| `src/App.test.tsx` | שינוי | עדכון הבדיקה "אין פעולות כתיבה" (עכשיו יש "הוסף משימה", עדיין אין שמור/מחק) + זרימת יצירה |
| `tests/api/tasks.integration.test.ts` | שינוי | יצירה, תקרה, יצירות מקבילות – מול Dev |
| `tests/e2e/create.spec.ts` | חדש | זרימות יצירה ב-Chrome (Desktop + Mobile) |
| `src/test-setup.ts` | שינוי אם צריך | השלמה ל-`HTMLDialogElement.showModal/close` אם jsdom לא תומך |

## 3. Validation משותף – `shared/validation.ts`

- קבועים: `TITLE_MAX = 100`, `DESCRIPTION_MAX = 2000`, `MAX_TASKS = 1000`, `PRODUCT_TIME_ZONE = 'Asia/Jerusalem'`.
- `validationMessages` – בדיוק לפי PRD 4.ג: `"יש להזין כותרת או תיאור למשימה"`, `"הכותרת יכולה להכיל עד 100 תווים."`, `"התיאור יכול להכיל עד 2,000 תווים."`, `"תאריך היעד לא יכול להיות בעבר."`, `"תאריך היעד אינו תקין."`.
- `todayInTimeZone(timeZone, now = new Date())` – `YYYY-MM-DD` דרך `Intl.DateTimeFormat('en-CA', {timeZone})`. לא `toISOString()`.
- `validateTaskInput(input, { today })` מחזיר `{ ok: true, value }` עם ערכים מנורמלים, או `{ ok: false, errors }` כש-`errors` הוא מפה `field → message` (`field`: `title` / `description` / `dueDate` / `content`).
  - `trim` לכותרת ולתיאור; מחרוזת ריקה ← `null`.
  - שניהם `null` ← שגיאת `content`.
  - אורך נמדד ב-Code Points (`[...s].length`), לא ב-`s.length`.
  - `dueDate`: `null` מותר; אחרת חייב להתאים ל-`^\d{4}-\d{2}-\d{2}$` ולהיות תאריך קיים (למשל לא `2026-02-30`), אחרת "אינו תקין"; תאריך קטן מ-`today` (השוואת מחרוזות) ← "לא יכול להיות בעבר".
  - מחזיר את **כל** השגיאות בבת אחת, כדי שהטופס יציג כל אחת ליד השדה שלה.
- הכלל "תאריך שמור שלא שונה" (ADR-8) יתווסף ב-M3; הפונקציה בנויה כך שיהיה קל להוסיף לה פרמטר `savedDueDate`.

## 4. שרת – `POST /api/tasks`

### 4.1 Handler (`server/tasksHandler.ts`)
- `allowMethods(['GET', 'POST'])`; `GET` נשאר בדיוק כמו היום.
- `POST`:
  1. `Content-Type` חייב להיות `application/json` ← אחרת `400 INVALID_REQUEST`.
  2. גודל Body עד 16KB (לפי `content-length`) ← אחרת `413 PAYLOAD_TOO_LARGE`.
  3. Body חייב להיות אובייקט; `title`/`description`/`dueDate` חייבים להיות מחרוזת או `null` (שדה חסר = `null`); שדות אחרים (למשל `completed`, `position`) מתעלמים מהם ← סוג שגוי מחזיר `400 INVALID_REQUEST`.
  4. `validateTaskInput` עם `today = todayInTimeZone(PRODUCT_TIME_ZONE)` ← שגיאה מחזירה `422 VALIDATION_ERROR` עם `message` בעברית ו-`field` (השגיאה הראשונה).
  5. `repository.createTask(value)` ← `201` עם המשימה החדשה.
  6. `TaskLimitError` ← `409 TASK_LIMIT_REACHED` עם `"לא ניתן להוסיף משימה: הרשימה התמלאה. מחק משימה קיימת ונסה שוב."`.
  7. כל שגיאה אחרת ← `sendServerError` הקיים (500/503 בלי לחשוף SQL).
- כל התשובות עם `Cache-Control: no-store` (כבר ב-`sendJson`).

### 4.2 Repository (`createTask`)
- מקבל `Pick<pg.Pool, 'query' | 'connect'>`. Transaction על **אותו `client`** מ-`begin` עד `commit`/`rollback`, ו-`release` ב-`finally` (ARCHITECTURE 2.9).
- בתוך ה-Transaction:
  1. `select pg_advisory_xact_lock($1)` עם קבוע משותף `TASKS_LIST_LOCK_KEY` (מספר קבוע אחד, שישמש גם מחיקה וגרירה ב-M3/M4).
  2. `select count(*)::int as count, coalesce(max(position) + 1, 0) as next from public.tasks`.
  3. `count >= MAX_TASKS` ← `rollback` וזריקת `TaskLimitError`.
  4. `insert ... (title, description, due_date, position) values ($1,$2,$3,$4) returning id, title, description, due_date, completed, position` – `completed` לפי ברירת המחדל (`false`).
  5. `commit`.
- `max + 1` (ולא `count`) כדי להיות בטוח גם אם יש פערים במיקומים מנתוני הבדיקה; הנרמול ל-0..N-1 יגיע עם מחיקה וגרירה.
- SQL פרמטרי בלבד.

## 5. לקוח

### 5.1 `src/api/tasksApi.ts`
- `createTask(input: TaskInput): Promise<Task>` – `POST /api/tasks`, `Content-Type: application/json`.
- בתשובה שאינה `ok`: זורק `ApiRequestError` עם `status`, ואם יש – `code`, `message`, `field` מגוף השגיאה. שגיאת רשת נשארת `TypeError` של `fetch`.

### 5.2 כפתור **"הוסף משימה"** בדף הבית
- בתוך `.home-header`, לצד הכותרת **המשימות שלי** (בדסקטופ בצד השמאלי לפי ה-Wireframe; במובייל ברוחב מלא מעל הרשימה).
- מצב Disabled (לפי סגנון Disabled ב-Style Guide) כאשר:
  - ברשימה שבידי הלקוח יש 1,000 משימות או יותר ← לידו מוצגת ההודעה **"הרשימה מלאה (1,000 משימות). כדי להוסיף משימה, מחק משימה קיימת."**;
  - הרשימה עדיין נטענת או שהטעינה נכשלה (אין רשימה שאפשר להוסיף אליה ולבחור בה את החדשה; הודעת השגיאה של הרשימה כבר מוצגת).

### 5.3 רכיב `Modal`
- מבוסס על אלמנט `<dialog>` המובנה של הדפדפן עם `showModal()`: Overlay, חסימת הדף שמאחור ומיקוד בתוך החלון ללא קוד נוסף.
- Props: `open`, `title`, `onClose`, `closeDisabled`, `children`. `aria-labelledby` לכותרת.
- Esc ← `onClose` (דרך אירוע `cancel`; כאשר `closeDisabled` – `preventDefault`).
- לחיצה על ה-Overlay **לא** סוגרת (התנהגות ברירת המחדל של `<dialog>`; לא מוסיפים מאזין).
- אייקון סגירה X (SVG קווי פשוט) עם `aria-label="סגור"`.
- כשה-Modal נסגר, המיקוד חוזר לכפתור שפתח אותו (התנהגות מובנית של `<dialog>`).

### 5.4 `CreateTaskModal`
- כותרת **"הוספת משימה"**; שדות לפי סדר ה-Wireframe:
  - **כותרת** – `input type="text"`, Placeholder **"הזן כותרת (לא חובה)"**;
  - **תיאור** – `textarea`, Placeholder **"הזן תיאור (לא חובה)"**;
  - **תאריך יעד** – `input type="date"`, ערך התחלתי `localToday()`, `min={localToday()}`, ללא שעה.
- כפתורים: **"הוסף משימה"** (Primary, `type="submit"`) ו-**"סגור"** (Secondary).
- `noValidate` על הטופס, כדי שההודעות יגיעו מהקוד (בעברית ובתוך הטופס) ולא מבועות של Chrome. לא משתמשים ב-`maxLength`, כי הוא סופר יחידות UTF-16 ולא תווים (ADR-6); חריגה מוצגת כהודעה.
- **איפוס:** הטופס נבנה מחדש בכל פתיחה (רכיב נפרד שמורכב רק כש-`open`), כך שסגירה ופתיחה מחדש מחזירות כותרת ותיאור ריקים ותאריך היום – ללא התראה בסגירה.
- **שליחה:**
  1. `validateTaskInput` עם `today = localToday()`. שגיאות מוצגות: אורך כותרת – מתחת לשדה הכותרת; אורך תיאור – מתחת לתיאור; תאריך – מתחת לתאריך; "יש להזין כותרת או תיאור" – בתיבת שגיאה מעל הכפתורים (כמו ב-Wireframe). השדה הרלוונטי מקבל `aria-invalid` ו-`aria-describedby`. הנתונים לא נמחקים.
  2. שינוי בשדה מנקה את השגיאה של אותו שדה (וגם את שגיאת התוכן כשמקלידים כותרת או תיאור).
  3. אם תקין – `createTask` עם הערכים **המקוריים** (השרת מבצע `trim` בעצמו).
  4. בזמן השליחה: כפתור **"הוסף משימה"** Disabled; גם **"סגור"**, X ו-Esc חסומים עד לתשובה, כדי שלא ייווצר מצב שבו החלון נסגר והמשימה בכל זאת נשמרת בלי להופיע. כך לחיצה כפולה לא יוצרת שתי משימות.
  5. **הצלחה** ← `onCreated(task)`: דף הבית מוסיף את המשימה לסוף הרשימה, סוגר את ה-Modal ובוחר אותה (אותו `handleSelect` – במובייל גלילה לפרטים); בדסקטופ השורה החדשה נגללת לתצוגה בתוך אזור הרשימה.
  6. **כישלון** ← ה-Modal והערכים נשארים, והודעה בתיבת השגיאה שבטופס:
     - `409 TASK_LIMIT_REACHED` ← **"לא ניתן להוסיף משימה: הרשימה התמלאה. מחק משימה קיימת ונסה שוב."**
     - `422` ← ההודעה מהשרת ליד השדה שב-`field` (למשל תאריך שנחשב עבר לפי אזור הזמן של השרת, ADR-5);
     - `429` ← **"יותר מדי פעולות בזמן קצר. המתן רגע ונסה שוב."**
     - שגיאת רשת כש-`navigator.onLine === false` ← **"אין חיבור לאינטרנט. לא ניתן לצפות במשימות או לשנות אותן עד שהחיבור יחזור."**
     - כל השאר ← **"השמירה נכשלה. נסה שוב."**
     - הכפתור חוזר להיות זמין לניסיון חוזר.

### 5.5 עיצוב (`styles.css`)
- כפתורים: `.btn`, `.btn-primary` (רקע `--primary`, טקסט לבן, Hover כהה יותר), `.btn-secondary` (לבן עם מסגרת כחולה, Hover `--selected-background`), מצב `:disabled` אפור בהיר לפי ה-Style Guide; פינות `--radius-sm`.
- Modal: `dialog::backdrop` אפור כהה שקוף-למחצה; חלון לבן ממורכז, `--radius-lg`, `--shadow`, רוחב עד כ-480px ו-`calc(100vw - 32px)` במובייל; RTL.
- שגיאות: `.field-error` טקסט אדום קטן מתחת לשדה; `.form-error` תיבה ברקע אדום עדין עם טקסט `--error`; שדה עם `aria-invalid="true"` מקבל מסגרת אדומה.
- הודעת רשימה מלאה: טקסט משני קטן ליד הכפתור.
- הליטוש המלא נשאר ל-M5; כאן – תאימות למבנה ה-Wireframe ולצבעי ה-Style Guide.

### 5.6 `src/messages.ts`
מוסיפים (נוסח מדויק מ-PRD 4.ג): `listFull`, `listFullOnCreate`, `saveFailed`, `tooManyRequests`, `titlePlaceholder`, `descriptionPlaceholder`. הודעות ה-Validation מגיעות מ-`shared/validation.ts`.

## 6. בדיקות

### 6.1 Unit – `shared/validation.test.ts`
- כותרת בלבד / תיאור בלבד / שניהם תקינים; `trim` ונרמול ריק ל-`null`.
- רווחים/שורות ריקות בלבד בשני השדות ← שגיאת תוכן.
- 100/101 תווים בכותרת, 2000/2001 בתיאור; אימוג'י נספר כתו אחד.
- תאריך היום תקין, אתמול ← עבר, `null` תקין, `2026-02-30` / `abc` ← לא תקין.
- `todayInTimeZone` עם `now` קבוע סביב חצות (UTC לעומת ירושלים).

### 6.2 Handler – `server/tasksHandler.test.ts` (Repository מדומה)
- `POST` תקין ← `201` עם המשימה; הערכים שהועברו ל-Repository מנורמלים; `completed`/`position` שנשלחו מהלקוח מתעלמים.
- Content-Type שגוי ← 400; Body גדול ← 413; סוג שגוי ← 400; Validation ← 422 עם `field`; `TaskLimitError` ← 409 `TASK_LIMIT_REACHED`; שגיאת DB ← 500 בלי דליפה.
- `PUT`/`DELETE` ← 405 עם `Allow: GET, POST`. בדיקות ה-`GET` הקיימות נשארות.

### 6.3 רכיבים – `CreateTaskModal.test.tsx` + `App.test.tsx`
- פתיחה: שדות ריקים, Placeholders, תאריך = היום; ניקוי תאריך אפשרי.
- הודעות Validation בכל המקרים, בלי קריאה לשרת ובלי מחיקת ערכים.
- כפתור חסום בזמן שליחה; לחיצה כפולה ← בקשה אחת.
- הצלחה ← Modal נסגר, השורה בסוף הרשימה, נבחרת והפרטים מוצגים.
- 409 / 500 / שגיאת רשת ← Modal נשאר, ערכים נשארים, הודעה מתאימה, ניסיון חוזר מצליח.
- סגירה ב-X / "סגור" / Esc ופתיחה מחדש ← טופס מאופס; לחיצה על ה-Overlay לא סוגרת.
- 1,000 משימות ← כפתור Disabled והודעת רשימה מלאה; 999 ← זמין.
- הבדיקה הקיימת "אין פעולות כתיבה" מתעדכנת: אין **שמור**/**מחק** (עדיין M3).

### 6.4 Integration מול Dev – `tests/api/tasks.integration.test.ts`
(שמירת הנתונים ושחזורם בסיום כמו היום, ADR-7.)
- יצירה ← רשומה אחת, `completed=false`, `position` אחרי המקסימום, ערכים מנורמלים.
- רשימה ריקה ← `position = 0`.
- 1,000 משימות (הכנסה מהירה ב-`generate_series`) ← `TaskLimitError`, מספר השורות נשאר 1,000.
- 999 משימות ושתי יצירות מקבילות משני Pools נפרדים ← בדיוק אחת מצליחה, אחת נדחית, בסוף 1,000 שורות.
- כמה יצירות מקבילות ברשימה רגילה ← כל המיקומים שונים.

### 6.5 E2E ב-Chrome – `tests/e2e/create.spec.ts` (Desktop + Mobile, מול `vercel dev` ו-Dev)
- יצירה עם כותרת בלבד, עם תיאור בלבד, ועם שניהם ובלי תאריך ← מופיעה בסוף הרשימה, נבחרת, פרטיה מוצגים; אחרי Refresh עדיין קיימת; ב-Context חדש של דפדפן (חלון/מכשיר אחר) גם רואים אותה.
- Validation בטופס (ריק, ארוך, תאריך בעבר).
- סגירה ופתיחה מחדש מאפסות.
- שגיאת שרת מדומה (`page.route` על `POST` בלבד, פעם אחת) ← הודעה, ערכים נשארים, ניסיון שני מצליח.
- `GET` מדומה עם 1,000 משימות ← כפתור Disabled והודעה.
- `POST` מדומה שמחזיר 409 ← הודעת "הרשימה התמלאה" בטופס, ערכים נשארים.
- במובייל: יצירה גוללת לאזור הפרטים.
- בדיקות ה-E2E של Milestone 1 ממשיכות לעבור (רגרסיה).

### 6.6 בדיקות כלליות לפני סיום
`npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e`, ובדיקה ידנית קצרה ב-`npm start`.

## 7. מיפוי ל-Definition of Done

| תנאי | איפה נבדק |
|---|---|
| יצירה עם כותרת בלבד / תיאור בלבד / שניהם; תאריך אופציונלי | 6.1, 6.3, 6.4, 6.5 |
| ריק/רווחים, חריגת אורך ותאריך בעבר נחסמים עם הודעה בטופס | 6.1, 6.2, 6.3, 6.5 |
| תאריך התחלתי היום, ניתן לנקות, אין בחירת שעה | 6.3, 6.5 |
| רשומה אחת במסד, "לביצוע", מוצגת, Modal נסגר, נבחרת | 6.3, 6.4, 6.5 |
| 1,000: כפתור לא זמין + הודעה; API מחזיר 409 גם בבקשות מקבילות | 6.3, 6.4, 6.5 |
| סגירה ופתיחה מאפסות; שגיאת שרת משאירה Modal וערכים ומאפשרת ניסיון חוזר | 6.3, 6.5 |
| נראה אחרי Refresh ומחלון אחר; בדיקות קודמות עוברות | 6.5, 6.6 |

## 8. החלטות שיתועדו כ-ADR במהלך הבנייה
- **ADR-16:** Modal מבוסס `<dialog>` מובנה; חסימת סגירה בזמן שליחת היצירה.
- **ADR-17:** כפתור "הוסף משימה" זמין רק אחרי טעינה מוצלחת של הרשימה; `max(position) + 1` למיקום משימה חדשה עד שהנרמול יתווסף ב-M3/M4.

## 9. נקודות לתשומת לב
- **ניקוי תאריך:** משתמשים בבקר התאריך המובנה של Chrome. בטלפון יש בו כפתור "ניקוי"; במחשב מנקים במקש Backspace/Delete בתוך השדה. לא מוסיפים כפתור "נקה" משלנו, כי הוא לא מופיע ב-Wireframe.
- בדיקות ה-Integration וה-E2E משנות את נתוני Dev זמנית ומחזירות אותם בסיום (ADR-7, ADR-11).
- אין משתנה סביבה חדש ואין Migration חדשה.
